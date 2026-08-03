import type { Db } from '@/lib/db/client'
import { getDb } from '@/lib/db/connection'
import { selectNextCafeNeedingHours } from '@/lib/db/queries/admin-cafes'
import { selectNextReviewable } from '@/lib/db/queries/candidate-queries'

// Use case: the operator's "continue" targets from a café curation page — the
// top of the GP-1 review queue and the next café still blocked by incomplete
// hours (Decision 28 gate). Read-only; rendered server-side so the links stay
// fresh after every save via the page revalidation.

export interface CurationNextSteps {
  nextCandidateId: string | null
  reviewableCount: number
  nextHoursCafe: { id: string; name: string } | null
  hoursIncompleteCount: number
}

export async function getCurationNextSteps(
  currentPlaceId: string,
  db: Db = getDb(),
): Promise<CurationNextSteps> {
  const [queue, hours] = await Promise.all([
    selectNextReviewable(db),
    selectNextCafeNeedingHours(db, currentPlaceId),
  ])
  return {
    nextCandidateId: queue.nextCandidateId,
    reviewableCount: queue.reviewableCount,
    nextHoursCafe: hours.next,
    hoursIncompleteCount: hours.count,
  }
}
