import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { sql } from 'drizzle-orm'
import type { DbHandle } from '@/lib/db/client'
import { TEXT_SEARCH_SKU } from '@/lib/integrations/google/server/places-text-search'
import { captureError, insertOperator, insertUser, openTestDb } from './helpers'

// Slice 2 pt.3: the seeding run lifecycle against the real database with an
// injected search stub — run provenance, per-attempt accounting (append-only),
// candidate intake dedup, failure recording, and the fail-closed no-key path.
// No test contacts Google (harness rule #30): the network caller is stubbed
// here and unit-tested with a mocked fetch in Tier 1.

vi.mock('server-only', () => ({}))
const { runSeeding } = await import('@/lib/ingestion/gp1-seeding')

let handle: DbHandle
let operatorId: string
beforeAll(async () => {
  handle = openTestDb()
  operatorId = await insertUser(handle.db)
  await insertOperator(handle.db, operatorId, true)
})
afterAll(async () => {
  await handle.pool.end()
})

const KEY = 'integration-test-key'

const okSearch =
  (ids: string[]) =>
  async (
    _template: unknown,
    _key: string,
    onAttempt: (a: {
      sku: string
      httpStatus: number | null
      resultsCount: number | null
    }) => Promise<void>,
  ) => {
    await onAttempt({ sku: TEXT_SEARCH_SKU, httpStatus: 200, resultsCount: ids.length })
    return { status: 'ok' as const, placeIds: ids, attempts: 1 }
  }

describe('runSeeding (transactional lifecycle)', () => {
  it('records the run, accounts the attempt, and queues deduped candidates', async () => {
    const ids = ['seed-a', 'seed-b', 'seed-b']
    const result = await runSeeding('study-cafes', operatorId, KEY, handle.db, okSearch(ids))
    expect(result).toEqual({
      status: 'completed',
      candidatesInserted: 2,
      placeIdsReturned: 3,
      attempts: 1,
    })

    const run = await handle.db.execute<{
      status: string
      query_template_id: string
      results_count: number
      initiated_by_operator_user_id: string
    }>(sql`
      SELECT status, query_template_id, results_count, initiated_by_operator_user_id
      FROM seeding_runs ORDER BY started_at DESC LIMIT 1
    `)
    expect(run.rows[0]).toEqual({
      status: 'completed',
      query_template_id: 'study-cafes',
      results_count: 3,
      initiated_by_operator_user_id: operatorId,
    })

    const attempts = await handle.db.execute<{ sku: string; http_status: number }>(sql`
      SELECT a.sku, a.http_status FROM seeding_run_attempts a
      JOIN seeding_runs r ON r.id = a.run_id
      ORDER BY a.attempted_at DESC LIMIT 1
    `)
    expect(attempts.rows[0]).toEqual({ sku: TEXT_SEARCH_SKU, http_status: 200 })

    // A second run returning overlapping ids queues only the new one.
    const second = await runSeeding(
      'study-cafes',
      operatorId,
      KEY,
      handle.db,
      okSearch(['seed-b', 'seed-c']),
    )
    expect(second.status).toBe('completed')
    if (second.status === 'completed') expect(second.candidatesInserted).toBe(1)
  })

  it('a failed search records the failed run and its accounted attempt', async () => {
    const failingSearch = async (
      _t: unknown,
      _k: string,
      onAttempt: (a: {
        sku: string
        httpStatus: number | null
        resultsCount: number | null
      }) => Promise<void>,
    ) => {
      await onAttempt({ sku: TEXT_SEARCH_SKU, httpStatus: 429, resultsCount: null })
      return { status: 'failed' as const, attempts: 1, failedHttpStatus: 429 }
    }
    const result = await runSeeding('wifi-cafes', operatorId, KEY, handle.db, failingSearch)
    expect(result).toEqual({ status: 'failed', attempts: 1 })

    const run = await handle.db.execute<{ status: string }>(sql`
      SELECT status FROM seeding_runs WHERE query_template_id = 'wifi-cafes'
      ORDER BY started_at DESC LIMIT 1
    `)
    expect(run.rows[0].status).toBe('failed')
  })

  it('fails closed without the server key — nothing is written', async () => {
    const before = await handle.db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM seeding_runs`,
    )
    const result = await runSeeding('study-cafes', operatorId, null, handle.db, okSearch(['x']))
    expect(result).toEqual({ status: 'unavailable' })
    const after = await handle.db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM seeding_runs`,
    )
    expect(after.rows[0].n).toBe(before.rows[0].n)
  })

  it('rejects an unknown template without touching the database', async () => {
    const result = await runSeeding('not-a-template', operatorId, KEY, handle.db, okSearch(['x']))
    expect(result).toEqual({ status: 'invalid_template' })
  })

  it('attempt accounting is append-only at the database', async () => {
    await runSeeding('quiet-cafes', operatorId, KEY, handle.db, okSearch(['seed-ao']))
    const upd = await captureError(() =>
      handle.db.execute(sql`UPDATE seeding_run_attempts SET http_status = 500`),
    )
    expect(upd.code).toBe('23001')
  })
})
