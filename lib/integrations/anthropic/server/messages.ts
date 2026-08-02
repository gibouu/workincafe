import 'server-only'
import { z } from 'zod'
import { type AssistBrief, assistBriefJsonSchema, assistBriefSchema } from '@/lib/domain/assist'
import type { OutboundAttempt } from '@/lib/domain/seeding-queries'

// Server-only Anthropic Messages caller for the Decision 27 editorial pre-read
// (27c: approved no-training provider, hand-written fetch — no SDK dependency).
// Single-turn inference over transient inputs (text + photos); the structured
// brief is validated against the domain contract and returned session-only.
// Compliance posture mirrors the Google callers: `no-store`; one accounting
// callback per actual outbound attempt (success and failure); no automatic
// retry; request/response bodies are NEVER logged, thrown, or embedded in
// errors — prompts contain live Google content and must not reach any log.

const MESSAGES_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
// Deliberate, reviewed edits only. Sonnet 5 chosen 2026-08-02 (operator cost
// ruling): rubric-guided classification sits well within Sonnet-tier
// capability at ~1/3 the cost; predictions are stamped per model, so if the
// agreement scorecard shows Sonnet lagging the operator, reverting to
// claude-opus-4-8 is a one-line change validated by data.
export const ASSIST_MODEL = 'claude-sonnet-5'
export const ANTHROPIC_MESSAGES_SKU = 'anthropic_messages_assist'
const MAX_TOKENS = 2000

const responseSchema = z.looseObject({
  stop_reason: z.string().nullish(),
  content: z.array(z.looseObject({ type: z.string(), text: z.string().optional() })).default([]),
})

export interface AssistImage {
  mediaType: string
  base64: string
}

export type AssistInferenceResult =
  | { status: 'ok'; brief: AssistBrief }
  | { status: 'failed'; reason: 'http' | 'network' | 'refusal' | 'truncated' | 'malformed' }

type FetchLike = (url: string, init: RequestInit) => Promise<Response>

export async function runAssistInference(
  input: { system: string; userText: string; images: AssistImage[] },
  apiKey: string,
  onAttempt: (attempt: OutboundAttempt) => Promise<void>,
  fetchImpl: FetchLike = fetch,
): Promise<AssistInferenceResult> {
  const content: Array<Record<string, unknown>> = [
    ...input.images.map((img) => ({
      type: 'image',
      source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
    })),
    { type: 'text', text: input.userText },
  ]

  let response: Response
  try {
    response = await fetchImpl(MESSAGES_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: ASSIST_MODEL,
        max_tokens: MAX_TOKENS,
        thinking: { type: 'adaptive' },
        system: input.system,
        output_config: {
          effort: 'medium',
          format: { type: 'json_schema', schema: assistBriefJsonSchema() },
        },
        messages: [{ role: 'user', content }],
      }),
    })
  } catch {
    await onAttempt({ sku: ANTHROPIC_MESSAGES_SKU, httpStatus: null, resultsCount: null })
    return { status: 'failed', reason: 'network' }
  }

  if (!response.ok) {
    await onAttempt({
      sku: ANTHROPIC_MESSAGES_SKU,
      httpStatus: response.status,
      resultsCount: null,
    })
    return { status: 'failed', reason: 'http' }
  }

  let parsed: z.infer<typeof responseSchema>
  try {
    parsed = responseSchema.parse(await response.json())
  } catch {
    await onAttempt({
      sku: ANTHROPIC_MESSAGES_SKU,
      httpStatus: response.status,
      resultsCount: null,
    })
    return { status: 'failed', reason: 'malformed' }
  }
  await onAttempt({ sku: ANTHROPIC_MESSAGES_SKU, httpStatus: response.status, resultsCount: 1 })

  if (parsed.stop_reason === 'refusal') return { status: 'failed', reason: 'refusal' }
  if (parsed.stop_reason === 'max_tokens') return { status: 'failed', reason: 'truncated' }

  const text = parsed.content.find((b) => b.type === 'text')?.text
  if (!text) return { status: 'failed', reason: 'malformed' }
  try {
    return { status: 'ok', brief: assistBriefSchema.parse(JSON.parse(text)) }
  } catch {
    return { status: 'failed', reason: 'malformed' }
  }
}
