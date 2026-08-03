import { z } from 'zod'
import type { Db } from '@/lib/db/client'
import { getDb } from '@/lib/db/connection'
import { insertProviderCallAttempt } from '@/lib/db/queries/accounting-mutations'
import { selectPlaceLookupInfo } from '@/lib/db/queries/admin-cafes'
import type { WeeklyHoursV1 } from '@/lib/domain/hours'
import { extractWebsiteHours, htmlToVisibleText } from '@/lib/domain/website-hours'
import { runHoursExtraction } from '@/lib/integrations/anthropic/server/extract-hours'
import { fetchVenuePage } from '@/lib/integrations/venue-site/server/fetch-page'
import { serverEnv } from '@/lib/env/server'

// Use case: operator-triggered hours check against the café's own recorded
// official website (Decision 30). One page fetch per click. Extraction order
// (amendment 30b): structured schema.org markup first; when none parses AND
// the Anthropic key is configured, one inexpensive model pass reads the
// visible page text — a prefill the operator verifies, labeled as AI-read.
// Session-only either way; persistence happens only through the ordinary
// curator save. The model call is accounted per attempt and never retried;
// without the key the fallback is silently skipped (fail closed to manual).

const placeIdSchema = z.uuid()
const MIN_TEXT_CHARS = 40

export type LookupWebsiteHoursResult =
  | {
      status: 'ok'
      websiteUrl: string
      finalUrl: string
      schedule: WeeklyHoursV1 | null
      /** How the schedule was obtained; null when none was extracted. */
      source: 'structured' | 'ai' | null
      foundStructuredHours: boolean
    }
  | { status: 'no_website' }
  | { status: 'not_found' }
  | { status: 'failed' }

export async function lookupWebsiteHours(
  placeId: string,
  db: Db = getDb(),
): Promise<LookupWebsiteHoursResult> {
  if (!placeIdSchema.safeParse(placeId).success) return { status: 'not_found' }
  const info = await selectPlaceLookupInfo(db, placeId)
  if (!info) return { status: 'not_found' }
  if (!info.website) return { status: 'no_website' }

  const page = await fetchVenuePage(info.website)
  if (page.status !== 'ok') return { status: 'failed' }

  const extraction = extractWebsiteHours(page.html)
  let schedule = extraction.schedule
  let source: 'structured' | 'ai' | null = schedule ? 'structured' : null

  if (schedule === null) {
    const apiKey = serverEnv().ANTHROPIC_API_KEY
    const pageText = htmlToVisibleText(page.html)
    if (apiKey && pageText.length >= MIN_TEXT_CHARS) {
      const ai = await runHoursExtraction(pageText, apiKey, async (attempt) => {
        await insertProviderCallAttempt(db, {
          sku: attempt.sku,
          context: 'website_hours_extract',
          candidateId: null,
          httpStatus: attempt.httpStatus,
        })
      })
      if (ai.status === 'ok' && ai.schedule) {
        schedule = ai.schedule
        source = 'ai'
      }
    }
  }

  return {
    status: 'ok',
    websiteUrl: info.website,
    finalUrl: page.finalUrl,
    schedule,
    source,
    foundStructuredHours: extraction.foundStructuredHours,
  }
}
