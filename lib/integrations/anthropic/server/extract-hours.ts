import 'server-only'
import { z } from 'zod'
import type { OutboundAttempt } from '@/lib/domain/seeding-queries'
import {
  scheduleFromModelDays,
  WEBSITE_HOURS_EXTRACTION_SYSTEM_PROMPT,
  websiteHoursModelOutputSchema,
} from '@/lib/domain/website-hours'
import type { WeeklyHoursV1 } from '@/lib/domain/hours'

// Server-only Anthropic caller for the Decision 30 (amendment 30b) website
// hours fallback: one inexpensive single-turn read of a venue page's visible
// text, returning a validated prefill the operator confirms. Compliance
// posture mirrors the assist caller: `no-store`; one accounting callback per
// actual outbound attempt; no automatic retry; request/response bodies are
// never logged, thrown, or embedded in errors.

const MESSAGES_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
// Deliberate, reviewed edits only. Haiku 4.5 chosen 2026-08-03 (operator cost
// ruling: "lowest and cheapest"): bounded JSON transcription of visible text
// sits well within Haiku-tier capability at ~1/3 Sonnet pricing. The operator
// verifies every prefill, so extraction misses cost seconds, not correctness.
export const HOURS_EXTRACT_MODEL = 'claude-haiku-4-5'
export const HOURS_EXTRACT_SKU = 'anthropic_messages_hours_extract'
const MAX_TOKENS = 800

const responseSchema = z.looseObject({
  stop_reason: z.string().nullish(),
  content: z.array(z.looseObject({ type: z.string(), text: z.string().optional() })).default([]),
})

export type HoursExtractionResult =
  | { status: 'ok'; schedule: WeeklyHoursV1 | null }
  | { status: 'failed'; reason: 'http' | 'network' | 'refusal' | 'truncated' | 'malformed' }

type FetchLike = (url: string, init: RequestInit) => Promise<Response>

export async function runHoursExtraction(
  pageText: string,
  apiKey: string,
  onAttempt: (attempt: OutboundAttempt) => Promise<void>,
  fetchImpl: FetchLike = fetch,
): Promise<HoursExtractionResult> {
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
        model: HOURS_EXTRACT_MODEL,
        max_tokens: MAX_TOKENS,
        system: WEBSITE_HOURS_EXTRACTION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: pageText }],
      }),
    })
  } catch {
    await onAttempt({ sku: HOURS_EXTRACT_SKU, httpStatus: null, resultsCount: null })
    return { status: 'failed', reason: 'network' }
  }

  if (!response.ok) {
    await onAttempt({ sku: HOURS_EXTRACT_SKU, httpStatus: response.status, resultsCount: null })
    return { status: 'failed', reason: 'http' }
  }

  let parsed: z.infer<typeof responseSchema>
  try {
    parsed = responseSchema.parse(await response.json())
  } catch {
    await onAttempt({ sku: HOURS_EXTRACT_SKU, httpStatus: response.status, resultsCount: null })
    return { status: 'failed', reason: 'malformed' }
  }
  await onAttempt({ sku: HOURS_EXTRACT_SKU, httpStatus: response.status, resultsCount: 1 })

  if (parsed.stop_reason === 'refusal') return { status: 'failed', reason: 'refusal' }
  if (parsed.stop_reason === 'max_tokens') return { status: 'failed', reason: 'truncated' }

  const text = parsed.content.find((b) => b.type === 'text')?.text
  if (!text) return { status: 'failed', reason: 'malformed' }
  try {
    const output = websiteHoursModelOutputSchema.parse(JSON.parse(text))
    if (!output.found) return { status: 'ok', schedule: null }
    const schedule = scheduleFromModelDays(output.days)
    return schedule ? { status: 'ok', schedule } : { status: 'failed', reason: 'malformed' }
  } catch {
    return { status: 'failed', reason: 'malformed' }
  }
}
