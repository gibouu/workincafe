import { describe, expect, it, vi } from 'vitest'
import { htmlToVisibleText } from '@/lib/domain/website-hours'

vi.mock('server-only', () => ({}))

const { runHoursExtraction, HOURS_EXTRACT_MODEL } =
  await import('@/lib/integrations/anthropic/server/extract-hours')

// Tier 1 coverage for the Decision 30 amendment 30b fallback: bounded visible
// text in, validated schedule out; accounted once; no retry; fails closed.

const VALID_DAYS = {
  monday: { state: 'open', intervals: [{ opens: '08:00', closes: '18:00', closesDayOffset: 0 }] },
  tuesday: { state: 'open', intervals: [{ opens: '08:00', closes: '18:00', closesDayOffset: 0 }] },
  wednesday: { state: 'unknown' },
  thursday: { state: 'closed' },
  friday: { state: 'open', intervals: [{ opens: '11:00', closes: '02:00', closesDayOffset: 1 }] },
  saturday: { state: 'unknown' },
  sunday: { state: 'unknown' },
}

function modelResponse(text: string, stopReason = 'end_turn'): Response {
  return new Response(
    JSON.stringify({ stop_reason: stopReason, content: [{ type: 'text', text }] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

describe('htmlToVisibleText', () => {
  it('strips scripts/styles/tags and decodes common entities', () => {
    const text = htmlToVisibleText(
      '<html><head><style>.x{}</style><script>var a=1</script></head>' +
        '<body><h1>Caf&eacute;</h1><p>Mon&ndash;Fri 8am &amp; more</p><!-- hidden --></body></html>',
    )
    expect(text).not.toContain('var a=1')
    expect(text).not.toContain('.x{}')
    expect(text).not.toContain('hidden')
    expect(text).toContain('Mon–Fri 8am & more')
  })

  it('bounds output length', () => {
    expect(htmlToVisibleText(`<p>${'x'.repeat(50_000)}</p>`, 1000).length).toBe(1000)
  })
})

describe('runHoursExtraction', () => {
  it('POSTs the cheapest model no-store and returns a validated schedule', async () => {
    const fetchImpl = vi.fn(async () =>
      modelResponse(JSON.stringify({ found: true, days: VALID_DAYS })),
    )
    const onAttempt = vi.fn(async (_attempt: { httpStatus: number | null }) => {})
    const result = await runHoursExtraction('Mon-Fri 8-6', 'key', onAttempt, fetchImpl)
    if (result.status !== 'ok') throw new Error('expected ok')
    expect(result.schedule?.days.friday).toEqual({
      state: 'open',
      intervals: [{ opens: '11:00', closes: '02:00', closesDayOffset: 1 }],
    })
    expect(result.schedule?.days.wednesday).toEqual({ state: 'unknown' })
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(String(init.body))
    expect(body.model).toBe(HOURS_EXTRACT_MODEL)
    expect(body.model).toBe('claude-haiku-4-5')
    expect(init.cache).toBe('no-store')
    expect(onAttempt).toHaveBeenCalledTimes(1)
    expect(onAttempt.mock.calls[0][0]).toMatchObject({ httpStatus: 200, resultsCount: 1 })
  })

  it('returns a null schedule on found:false', async () => {
    const fetchImpl = vi.fn(async () => modelResponse(JSON.stringify({ found: false })))
    const result = await runHoursExtraction(
      'no hours here',
      'key',
      vi.fn(async () => {}),
      fetchImpl,
    )
    expect(result).toEqual({ status: 'ok', schedule: null })
  })

  it('fails closed on invalid day shapes instead of trusting the model', async () => {
    const fetchImpl = vi.fn(async () =>
      modelResponse(JSON.stringify({ found: true, days: { monday: { state: 'open?' } } })),
    )
    const result = await runHoursExtraction(
      'text',
      'key',
      vi.fn(async () => {}),
      fetchImpl,
    )
    expect(result).toEqual({ status: 'failed', reason: 'malformed' })
  })

  it('accounts failures once and never retries (http, refusal, truncation)', async () => {
    const httpFail = vi.fn(async () => new Response('', { status: 429 }))
    const onAttempt = vi.fn(async () => {})
    expect(await runHoursExtraction('t', 'key', onAttempt, httpFail)).toEqual({
      status: 'failed',
      reason: 'http',
    })
    expect(httpFail).toHaveBeenCalledTimes(1)
    expect(onAttempt).toHaveBeenCalledTimes(1)

    const refusal = vi.fn(async () => modelResponse('no', 'refusal'))
    expect(
      await runHoursExtraction(
        't',
        'key',
        vi.fn(async () => {}),
        refusal,
      ),
    ).toEqual({
      status: 'failed',
      reason: 'refusal',
    })

    const truncated = vi.fn(async () => modelResponse('{', 'max_tokens'))
    expect(
      await runHoursExtraction(
        't',
        'key',
        vi.fn(async () => {}),
        truncated,
      ),
    ).toEqual({
      status: 'failed',
      reason: 'truncated',
    })
  })
})
