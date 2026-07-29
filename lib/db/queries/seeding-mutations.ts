import { sql } from 'drizzle-orm'
import type { OutboundAttempt } from '@/lib/domain/seeding-queries'
import type { Db } from '../client'

// GP-1 seeding-run persistence (slice 2 pt.3). Runs record operator initiation
// and outcome; attempts are the append-only billable-call accounting — one row
// per actual outbound attempt, written for success and failure alike
// (Decision 16: accounted once, never auto-retried). No Google content is
// stored here: SKU, status code, and result count are our operational data.

export async function insertSeedingRun(
  db: Db,
  operatorUserId: string,
  queryTemplateId: string,
): Promise<string> {
  const res = await db.execute<{ id: string }>(sql`
    INSERT INTO seeding_runs (initiated_by_operator_user_id, query_template_id, status)
    VALUES (${operatorUserId}, ${queryTemplateId}, 'running')
    RETURNING id
  `)
  return res.rows[0].id
}

export async function insertSeedingAttempt(
  db: Db,
  runId: string,
  attempt: OutboundAttempt,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO seeding_run_attempts (run_id, sku, http_status, results_count)
    VALUES (${runId}, ${attempt.sku}, ${attempt.httpStatus}, ${attempt.resultsCount})
  `)
}

export async function completeSeedingRun(
  db: Db,
  runId: string,
  outcome: { status: 'completed' | 'failed'; resultsCount: number | null },
): Promise<void> {
  await db.execute(sql`
    UPDATE seeding_runs
    SET status = ${outcome.status}, completed_at = now(), results_count = ${outcome.resultsCount}
    WHERE id = ${runId}
  `)
}

export interface SeedingRunRow {
  id: string
  queryTemplateId: string
  status: 'running' | 'completed' | 'failed'
  startedAt: string
  resultsCount: number | null
  attemptCount: number
  candidatesInserted: number
}

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value)
}

export async function selectRecentSeedingRuns(db: Db, limit = 10): Promise<SeedingRunRow[]> {
  const res = await db.execute<{
    id: string
    query_template_id: string
    status: 'running' | 'completed' | 'failed'
    started_at: unknown
    results_count: number | null
    attempt_count: number
    candidates_inserted: number
  }>(sql`
    SELECT r.id, r.query_template_id, r.status, r.started_at, r.results_count,
      (SELECT count(*)::int FROM seeding_run_attempts a WHERE a.run_id = r.id) AS attempt_count,
      (SELECT count(*)::int FROM gp1_candidates c WHERE c.seeding_run_id = r.id) AS candidates_inserted
    FROM seeding_runs r
    ORDER BY r.started_at DESC
    LIMIT ${limit}
  `)
  return res.rows.map((r) => ({
    id: r.id,
    queryTemplateId: r.query_template_id,
    status: r.status,
    startedAt: toIso(r.started_at),
    resultsCount: r.results_count,
    attemptCount: r.attempt_count,
    candidatesInserted: r.candidates_inserted,
  }))
}
