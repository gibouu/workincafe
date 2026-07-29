import type { Db } from '@/lib/db/client'
import { getDb } from '@/lib/db/connection'
import { type CandidateQueueRow, selectReviewQueue } from '@/lib/db/queries/candidate-queries'

// Use case: the GP-1 review queue (pending + deferred candidates, FIFO by
// entry time — see the read-query note on why there is no ranking). Callers
// must already be authorized as an operator.
export async function listReviewQueue(db: Db = getDb()): Promise<CandidateQueueRow[]> {
  return selectReviewQueue(db)
}
