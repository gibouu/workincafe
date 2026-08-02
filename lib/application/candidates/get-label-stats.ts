import type { Db } from '@/lib/db/client'
import { getDb } from '@/lib/db/connection'
import {
  type LabelStats,
  type LatestPrediction,
  selectLabelStats,
  selectLatestPrediction,
} from '@/lib/db/queries/assist-mutations'

// Use cases: label-capture transparency (Decision 27d). Callers must already
// be authorized as an operator.

export async function getLabelStats(db: Db = getDb()): Promise<LabelStats> {
  return selectLabelStats(db)
}

export async function getLatestPrediction(
  candidateId: string,
  db: Db = getDb(),
): Promise<LatestPrediction | null> {
  return selectLatestPrediction(db, candidateId)
}
