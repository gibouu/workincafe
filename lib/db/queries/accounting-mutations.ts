import { sql } from 'drizzle-orm'
import type { Db } from '../client'

// Billable-call accounting outside seeding runs (Decisions 16/27): one row per
// actual outbound attempt, written for success and failure alike.
export async function insertProviderCallAttempt(
  db: Db,
  attempt: { sku: string; context: string; candidateId: string | null; httpStatus: number | null },
): Promise<void> {
  await db.execute(sql`
    INSERT INTO provider_call_attempts (sku, context, candidate_id, http_status)
    VALUES (${attempt.sku}, ${attempt.context}, ${attempt.candidateId}, ${attempt.httpStatus})
  `)
}
