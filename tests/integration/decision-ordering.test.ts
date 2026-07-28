import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import type { DbHandle } from '@/lib/db/client'
import {
  captureError,
  insertDecision,
  insertObservation,
  insertPlace,
  insertUser,
  openTestDb,
  setCurrentDirect,
} from './helpers'

// The monotonic decision `seq` is the SOLE effective-decision order — not
// (decided_at, id). These tests append decisions that share an identical
// timestamp and prove the later append wins (Step 3B strict-gate amendment).
const CHECK = '23514'
const SAME_TS = '2020-01-01T00:00:00Z'

let handle: DbHandle
let userId: string
beforeAll(async () => {
  handle = openTestDb()
  userId = await insertUser(handle.db)
})
afterAll(async () => {
  await handle.pool.end()
})

describe('decision ordering by monotonic seq', () => {
  it('same-timestamp: a later accepted append wins → observation can be current', async () => {
    const placeId = await insertPlace(handle.db)
    const obs = await insertObservation(handle.db, {
      placeId,
      kind: 'wifi',
      value: 'fast',
      provenanceKind: 'curator',
    })
    await insertDecision(handle.db, {
      observationId: obs,
      decision: 'rejected',
      decidedBy: userId,
      decidedAt: SAME_TS,
    })
    await insertDecision(handle.db, {
      observationId: obs,
      decision: 'accepted',
      decidedBy: userId,
      decidedAt: SAME_TS,
    })
    await expect(setCurrentDirect(handle.db, placeId, 'wifi', obs)).resolves.toBeUndefined()
  })

  it('same-timestamp: a later rejected append wins → observation cannot be current', async () => {
    const placeId = await insertPlace(handle.db)
    const obs = await insertObservation(handle.db, {
      placeId,
      kind: 'noise',
      value: 'quiet',
      provenanceKind: 'curator',
    })
    await insertDecision(handle.db, {
      observationId: obs,
      decision: 'accepted',
      decidedBy: userId,
      decidedAt: SAME_TS,
    })
    await insertDecision(handle.db, {
      observationId: obs,
      decision: 'rejected',
      decidedBy: userId,
      decidedAt: SAME_TS,
    })
    expect(
      (await captureError(() => setCurrentDirect(handle.db, placeId, 'noise', obs))).code,
    ).toBe(CHECK)
  })

  it('seq is strictly increasing across appended decisions', async () => {
    const placeId = await insertPlace(handle.db)
    const obs = await insertObservation(handle.db, {
      placeId,
      kind: 'seating',
      value: 'ample',
      provenanceKind: 'curator',
    })
    await insertDecision(handle.db, {
      observationId: obs,
      decision: 'rejected',
      decidedBy: userId,
      decidedAt: SAME_TS,
    })
    await insertDecision(handle.db, {
      observationId: obs,
      decision: 'accepted',
      decidedBy: userId,
      decidedAt: SAME_TS,
    })
    // pg returns bigint/bigserial as strings (to avoid precision loss).
    const res = await handle.db.execute<{ seq: string; decision: string }>(
      sql`SELECT seq, decision FROM attribute_observation_decisions WHERE observation_id = ${obs} ORDER BY seq`,
    )
    expect(res.rows).toHaveLength(2)
    expect(Number(res.rows[0].seq)).toBeLessThan(Number(res.rows[1].seq))
    expect(res.rows[1].decision).toBe('accepted')
  })
})
