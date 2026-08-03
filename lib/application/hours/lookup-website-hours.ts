import { z } from 'zod'
import type { Db } from '@/lib/db/client'
import { getDb } from '@/lib/db/connection'
import { selectPlaceLookupInfo } from '@/lib/db/queries/admin-cafes'
import type { WeeklyHoursV1 } from '@/lib/domain/hours'
import { extractWebsiteHours } from '@/lib/domain/website-hours'
import { fetchVenuePage } from '@/lib/integrations/venue-site/server/fetch-page'

// Use case: operator-triggered hours check against the café's own recorded
// official website (Decision 30 — tooling assistance to the approved
// official-venue/manual sourcing model). One page fetch per click; extraction
// reads only machine-readable schema.org markup; the result is session-only
// prefill the operator confirms through the ordinary curator save.

const placeIdSchema = z.uuid()

export type LookupWebsiteHoursResult =
  | {
      status: 'ok'
      websiteUrl: string
      finalUrl: string
      schedule: WeeklyHoursV1 | null
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
  return {
    status: 'ok',
    websiteUrl: info.website,
    finalUrl: page.finalUrl,
    schedule: extraction.schedule,
    foundStructuredHours: extraction.foundStructuredHours,
  }
}
