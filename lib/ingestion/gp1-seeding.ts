import type { Db } from '@/lib/db/client'
import { getDb } from '@/lib/db/connection'
import { insertCandidates } from '@/lib/db/queries/candidate-mutations'
import {
  completeSeedingRun,
  insertSeedingAttempt,
  insertSeedingRun,
} from '@/lib/db/queries/seeding-mutations'
import {
  findSeedingTemplate,
  type OutboundAttempt,
  type SeedingQueryTemplate,
} from '@/lib/domain/seeding-queries'
import {
  searchPlaceIdsForSeeding,
  type TextSearchResult,
} from '@/lib/integrations/google/server/places-text-search'

// GP-1 seeding run (Decision 9's confirmed workflow — operator-initiated ONLY:
// no schedule, cron, queue, or page-load trigger; the caller is a gated Server
// Action behind an explicit operator gesture). One run = one approved template,
// executed once: attempts accounted as they happen, resulting Place IDs (the
// only retained Google data) deduped into the candidate queue, run outcome
// recorded. Fails closed with a clear status when the server key is absent
// (previews/local run without billable credentials by default, Decision 20).

export type RunSeedingResult =
  | { status: 'completed'; candidatesInserted: number; placeIdsReturned: number; attempts: number }
  | { status: 'failed'; attempts: number }
  | { status: 'unavailable' }
  | { status: 'invalid_template' }

type SearchFn = (
  template: SeedingQueryTemplate,
  apiKey: string,
  onAttempt: (attempt: OutboundAttempt) => Promise<void>,
) => Promise<TextSearchResult>

export async function runSeeding(
  templateId: string,
  actorUserId: string,
  apiKey: string | null,
  db: Db = getDb(),
  search: SearchFn = searchPlaceIdsForSeeding,
): Promise<RunSeedingResult> {
  const template = findSeedingTemplate(templateId)
  if (!template) return { status: 'invalid_template' }
  if (!apiKey) return { status: 'unavailable' }

  const runId = await insertSeedingRun(db, actorUserId, template.id)
  try {
    const result = await search(template, apiKey, (attempt) =>
      insertSeedingAttempt(db, runId, attempt),
    )
    if (result.status === 'failed') {
      await completeSeedingRun(db, runId, { status: 'failed', resultsCount: null })
      return { status: 'failed', attempts: result.attempts }
    }
    const { inserted } = await insertCandidates(db, runId, result.placeIds)
    await completeSeedingRun(db, runId, {
      status: 'completed',
      resultsCount: result.placeIds.length,
    })
    return {
      status: 'completed',
      candidatesInserted: inserted,
      placeIdsReturned: result.placeIds.length,
      attempts: result.attempts,
    }
  } catch (error) {
    await completeSeedingRun(db, runId, { status: 'failed', resultsCount: null })
    throw error
  }
}
