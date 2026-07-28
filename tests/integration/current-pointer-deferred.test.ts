import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import type { DbHandle } from '@/lib/db/client'
import {
  captureError,
  insertDecision,
  insertObservation,
  insertOperator,
  insertPlace,
  insertUser,
  openTestDb,
  seedAcceptedCurrent,
} from './helpers'

// Deferred, bidirectional current-pointer validation (Step 3B strict-gate
// amendment): the invariant is re-checked at COMMIT both when the pointer moves
// and when a new decision is appended, using final transaction state.
const CHECK = '23514'

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

async function currentObs(placeId: string, kind: string): Promise<string | null> {
  const res = await handle.db.execute<{ current_observation_id: string }>(
    sql`SELECT current_observation_id FROM place_attribute_current WHERE place_id = ${placeId} AND kind = ${kind}`,
  )
  return res.rows[0]?.current_observation_id ?? null
}

describe('deferred bidirectional current-pointer validation', () => {
  it('a later rejection of the current observation is rejected at commit (decision-side guard)', async () => {
    const placeId = await insertPlace(handle.db)
    const cur = await seedAcceptedCurrent(handle.db, {
      placeId,
      kind: 'wifi',
      value: 'fast',
      provenanceKind: 'curator',
      operatorUserId: operatorId,
    })
    // Appending a rejection for the current observation, with no repoint, must
    // fail at commit — a rejected observation cannot remain current.
    expect(
      (
        await captureError(() =>
          insertDecision(handle.db, {
            observationId: cur,
            decision: 'rejected',
            decidedBy: operatorId,
          }),
        )
      ).code,
    ).toBe(CHECK)
    // The failed (autocommit) transaction rolled back; the pointer is unchanged.
    expect(await currentObs(placeId, 'wifi')).toBe(cur)
  })

  it('rejection of the current observation PLUS a valid repoint in one transaction succeeds', async () => {
    const placeId = await insertPlace(handle.db)
    const cur = await seedAcceptedCurrent(handle.db, {
      placeId,
      kind: 'power',
      value: 'abundant',
      provenanceKind: 'curator',
      operatorUserId: operatorId,
    })
    const replacement = await insertObservation(handle.db, {
      placeId,
      kind: 'power',
      value: 'available',
      provenanceKind: 'curator',
      observedByOperatorUserId: operatorId,
    })
    await insertDecision(handle.db, {
      observationId: replacement,
      decision: 'accepted',
      decidedBy: operatorId,
    })
    // Reject the current observation and repoint to the accepted replacement in
    // the same transaction. Deferred validation sees the final state → succeeds.
    await handle.db.transaction(async (tx) => {
      await tx.execute(sql`
        INSERT INTO attribute_observation_decisions (observation_id, decision, decided_by_operator_user_id)
        VALUES (${cur}, 'rejected', ${operatorId})`)
      await tx.execute(sql`
        INSERT INTO place_attribute_current (place_id, kind, current_observation_id)
        VALUES (${placeId}, 'power', ${replacement})
        ON CONFLICT (place_id, kind) DO UPDATE SET current_observation_id = EXCLUDED.current_observation_id, updated_at = now()`)
    })
    expect(await currentObs(placeId, 'power')).toBe(replacement)
  })

  it('rejecting a non-current observation does not affect the pointer', async () => {
    const placeId = await insertPlace(handle.db)
    const cur = await seedAcceptedCurrent(handle.db, {
      placeId,
      kind: 'seating',
      value: 'ample',
      provenanceKind: 'curator',
      operatorUserId: operatorId,
    })
    const other = await insertObservation(handle.db, {
      placeId,
      kind: 'seating',
      value: 'limited',
      provenanceKind: 'curator',
      observedByOperatorUserId: operatorId,
    })
    await expect(
      insertDecision(handle.db, {
        observationId: other,
        decision: 'rejected',
        decidedBy: operatorId,
      }),
    ).resolves.toBeTruthy()
    expect(await currentObs(placeId, 'seating')).toBe(cur)
  })
})
