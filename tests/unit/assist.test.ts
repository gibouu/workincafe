import { describe, expect, it, vi } from 'vitest'
import {
  assistBriefJsonSchema,
  assistBriefSchema,
  buildAssistSystemPrompt,
} from '@/lib/domain/assist'
import { CANDIDATE_REJECT_REASONS } from '@/lib/domain/candidates'

// Tier 1 coverage for the Decision 27 pre-read callers and contracts.
// No test contacts Google or Anthropic — fetch is mocked throughout.

vi.mock('server-only', () => ({}))

const { fetchPlaceAssistContent, fetchPhotoMedia, PLACE_DETAILS_SKU } =
  await import('@/lib/integrations/google/server/place-details')
const { runAssistInference, ANTHROPIC_MESSAGES_SKU, ASSIST_MODEL } =
  await import('@/lib/integrations/anthropic/server/messages')

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const VALID_BRIEF = {
  brief: 'Looks study-friendly overall.',
  signals: [
    { finding: 'Laptops visible at several tables.', source: 'photos', supports: 'approve' },
  ],
  suggestedDecision: 'approved',
  suggestedReasonCode: null,
  confidence: 'medium',
}

describe('assist domain contract', () => {
  it('rubric prompt embeds every rejection reason and the own-words rules', () => {
    const prompt = buildAssistSystemPrompt()
    for (const r of CANDIDATE_REJECT_REASONS) expect(prompt).toContain(r)
    expect(prompt).toContain('NEVER quote')
    expect(prompt).toContain('faces')
  })

  it('brief schema is strict and the JSON schema forbids extra keys', () => {
    expect(assistBriefSchema.safeParse(VALID_BRIEF).success).toBe(true)
    expect(assistBriefSchema.safeParse({ ...VALID_BRIEF, extra: 'x' }).success).toBe(false)
    const js = assistBriefJsonSchema() as { additionalProperties?: boolean }
    expect(js.additionalProperties).toBe(false)
  })
})

describe('fetchPlaceAssistContent', () => {
  it('sends the approved field mask (no hours), no-store, and maps attributed display', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        id: 'p1',
        displayName: { text: 'Test Cafe' },
        formattedAddress: '1 Main St',
        rating: 4.5,
        userRatingCount: 120,
        googleMapsUri: 'https://maps.google.com/?cid=1',
        reviews: [
          {
            text: { text: 'Great for laptops' },
            relativePublishTimeDescription: 'a week ago',
            authorAttribution: {
              displayName: 'A. Reviewer',
              uri: 'https://g/1',
              photoUri: 'https://g/p1',
            },
          },
          { text: { text: 'No author — must be dropped' } },
        ],
        photos: [{ name: 'places/p1/photos/x' }],
        businessStatus: 'OPERATIONAL',
        primaryTypeDisplayName: { text: 'Coffee shop' },
        types: ['cafe', 'coffee_shop'],
        location: { latitude: 43.65, longitude: -79.38 },
        dineIn: true,
        takeout: true,
        reviewSummary: {
          text: { text: 'People study here' },
          disclosureText: { text: 'Summarized with AI' },
        },
      }),
    )
    const attempts: Array<{ sku: string }> = []
    const result = await fetchPlaceAssistContent(
      'p1',
      'k',
      async (a) => void attempts.push(a),
      fetchMock,
    )

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://places.googleapis.com/v1/places/p1')
    expect(init.cache).toBe('no-store')
    const mask = (init.headers as Record<string, string>)['X-Goog-FieldMask']
    expect(mask).toContain('reviews')
    expect(mask).toContain('businessStatus')
    expect(mask).toContain('dineIn')
    expect(mask).toContain('types')
    expect(mask).not.toContain('Hours')
    expect(mask).not.toContain('opening')

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.content.display.name).toBe('Test Cafe')
    // Attribution travels with the content; unattributed reviews are dropped.
    expect(result.content.display.reviews).toHaveLength(1)
    expect(result.content.display.reviews[0].authorName).toBe('A. Reviewer')
    expect(result.content.display.summaryDisclosure).toBe('Summarized with AI')
    expect(result.content.display.primaryType).toBe('Coffee shop')
    expect(result.content.display.latitude).toBe(43.65)
    // Tri-state: only provided booleans appear; absent ones are unknown, not false.
    expect(result.content.display.facts).toEqual([
      { label: 'dine-in', value: true },
      { label: 'takeout', value: true },
    ])
    expect(attempts).toEqual([{ sku: PLACE_DETAILS_SKU, httpStatus: 200, resultsCount: 1 }])
  })

  it('accounts failures once and never retries', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: 'x' }, 403))
    const attempts: unknown[] = []
    const result = await fetchPlaceAssistContent(
      'p1',
      'k',
      async (a) => void attempts.push(a),
      fetchMock,
    )
    expect(result).toEqual({ status: 'failed', httpStatus: 403 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(attempts).toHaveLength(1)
  })

  it('rejects non-image photo media', async () => {
    const fetchMock = vi.fn(
      async () => new Response('<html>', { status: 200, headers: { 'Content-Type': 'text/html' } }),
    )
    const photo = await fetchPhotoMedia('places/p/photos/x', 'k', async () => {}, fetchMock)
    expect(photo).toBeNull()
  })
})

describe('runAssistInference', () => {
  it('sends the pinned model, adaptive thinking, structured output, images-then-text, no-store', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: JSON.stringify(VALID_BRIEF) }],
      }),
    )
    const result = await runAssistInference(
      {
        system: 'rubric',
        userText: 'venue',
        images: [{ mediaType: 'image/jpeg', base64: 'aGk=' }],
      },
      'ak',
      async () => {},
      fetchMock,
    )
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.brief.suggestedDecision).toBe('approved')

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(init.cache).toBe('no-store')
    const body = JSON.parse(init.body as string)
    expect(body.model).toBe(ASSIST_MODEL)
    expect(body.thinking).toEqual({ type: 'adaptive' })
    expect(body.temperature).toBeUndefined()
    expect(body.output_config.format.type).toBe('json_schema')
    expect(body.messages[0].content[0].type).toBe('image')
    expect(body.messages[0].content.at(-1).type).toBe('text')
  })

  it('handles refusal and truncation as typed failures without retry', async () => {
    for (const [stop, reason] of [
      ['refusal', 'refusal'],
      ['max_tokens', 'truncated'],
    ] as const) {
      const fetchMock = vi.fn(async () => jsonResponse({ stop_reason: stop, content: [] }))
      const attempts: unknown[] = []
      const result = await runAssistInference(
        { system: 's', userText: 'u', images: [] },
        'ak',
        async (a) => void attempts.push(a),
        fetchMock,
      )
      expect(result).toEqual({ status: 'failed', reason })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(attempts).toHaveLength(1)
    }
  })

  it('a brief that violates the contract fails closed', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: JSON.stringify({ ...VALID_BRIEF, extra: 'nope' }) }],
      }),
    )
    const result = await runAssistInference(
      { system: 's', userText: 'u', images: [] },
      'ak',
      async () => {},
      fetchMock,
    )
    expect(result).toEqual({ status: 'failed', reason: 'malformed' })
  })

  it('accounts HTTP failures with the assist SKU', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: 'overloaded' }, 529))
    const attempts: Array<{ sku: string; httpStatus: number | null }> = []
    await runAssistInference(
      { system: 's', userText: 'u', images: [] },
      'ak',
      async (a) => void attempts.push(a),
      fetchMock,
    )
    expect(attempts).toEqual([{ sku: ANTHROPIC_MESSAGES_SKU, httpStatus: 529, resultsCount: null }])
  })
})

describe('rubricLoopStatus (the mechanical trigger)', () => {
  it('first distillation comes due exactly when the baseline batch completes', async () => {
    const { rubricLoopStatus, RUBRIC_BASELINE_TARGET } = await import('@/lib/domain/assist')
    expect(rubricLoopStatus(0).due).toBe(false)
    expect(rubricLoopStatus(RUBRIC_BASELINE_TARGET - 1).due).toBe(false)
    const due = rubricLoopStatus(RUBRIC_BASELINE_TARGET)
    expect(due.due).toBe(true)
    expect(due.isFirstDistillation).toBe(true)
    expect(due.nextDueAt).toBe(RUBRIC_BASELINE_TARGET)
  })
})
