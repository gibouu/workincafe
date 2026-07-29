import type { Db } from '@/lib/db/client'
import { getDb } from '@/lib/db/connection'
import { serverEnv } from '@/lib/env/server'
import { runSeeding, type RunSeedingResult } from '@/lib/ingestion/gp1-seeding'

// Use case: an authorized operator explicitly starts one GP-1 seeding run for
// one approved query template (Decision 9 — operator-initiated only; the
// template registry is the bounded, documented query set). The caller (a
// Server Action) has already resolved an active operator. The server Places
// key is resolved here from the validated env (feature-conditional — absent
// key fails closed inside the run, it is never demanded elsewhere).
export async function startSeedingRun(
  templateId: string,
  actorUserId: string,
  db: Db = getDb(),
): Promise<RunSeedingResult> {
  const apiKey = serverEnv().GOOGLE_PLACES_SERVER_KEY ?? null
  return runSeeding(String(templateId), actorUserId, apiKey, db)
}
