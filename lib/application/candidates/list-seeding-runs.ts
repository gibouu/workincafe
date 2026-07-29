import type { Db } from '@/lib/db/client'
import { getDb } from '@/lib/db/connection'
import { selectRecentSeedingRuns, type SeedingRunRow } from '@/lib/db/queries/seeding-mutations'

// Use case: recent GP-1 seeding runs with their accounting summary for the
// seeding surface. Callers must already be authorized as an operator.
export async function listSeedingRuns(db: Db = getDb()): Promise<SeedingRunRow[]> {
  return selectRecentSeedingRuns(db)
}
