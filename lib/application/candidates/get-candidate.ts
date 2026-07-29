import { z } from 'zod'
import type { Db } from '@/lib/db/client'
import { getDb } from '@/lib/db/connection'
import { type CandidateRow, selectCandidateById } from '@/lib/db/queries/candidate-queries'

// Use case: one candidate for the review page. Callers must already be
// authorized as an operator.

const idSchema = z.uuid()

export async function getCandidate(
  candidateId: string,
  db: Db = getDb(),
): Promise<CandidateRow | null> {
  if (!idSchema.safeParse(candidateId).success) return null
  return selectCandidateById(db, candidateId)
}
