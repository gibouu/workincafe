import { afterAll, beforeAll, describe, expect, it } from 'vitest'
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

// Covers required tests #17, #18. The cross-table constraint trigger
// wc_check_current_attribute RAISEs check_violation (23514).
const CHECK = '23514'

let handle: DbHandle
let userId: string
beforeAll(async () => {
  handle = openTestDb()
  userId = await insertUser(handle.db)
})
afterAll(async () => {
  await handle.pool.end()
})

describe('current attribute pointer invariant', () => {
  it('#17 cannot point at an observation from another place or another kind', async () => {
    const placeA = await insertPlace(handle.db)
    const placeB = await insertPlace(handle.db)
    const obsOnB = await insertObservation(handle.db, {
      placeId: placeB,
      kind: 'wifi',
      value: 'fast',
      provenanceKind: 'curator',
    })
    await insertDecision(handle.db, {
      observationId: obsOnB,
      decision: 'accepted',
      decidedBy: userId,
    })

    // Same kind, but the observation belongs to place B — rejected for place A.
    expect(
      (await captureError(() => setCurrentDirect(handle.db, placeA, 'wifi', obsOnB))).code,
    ).toBe(CHECK)

    // An observation on place A but of a different kind than the pointer row.
    const wifiOnA = await insertObservation(handle.db, {
      placeId: placeA,
      kind: 'wifi',
      value: 'usable',
      provenanceKind: 'curator',
    })
    await insertDecision(handle.db, {
      observationId: wifiOnA,
      decision: 'accepted',
      decidedBy: userId,
    })
    expect(
      (await captureError(() => setCurrentDirect(handle.db, placeA, 'noise', wifiOnA))).code,
    ).toBe(CHECK)
  })

  it('#18 cannot point at an observation whose latest decision is not accepted', async () => {
    const placeId = await insertPlace(handle.db)

    // No decision at all.
    const undecided = await insertObservation(handle.db, {
      placeId,
      kind: 'seating',
      value: 'ample',
      provenanceKind: 'curator',
    })
    expect(
      (await captureError(() => setCurrentDirect(handle.db, placeId, 'seating', undecided))).code,
    ).toBe(CHECK)

    // Latest decision is 'rejected'.
    const rejected = await insertObservation(handle.db, {
      placeId,
      kind: 'seating',
      value: 'limited',
      provenanceKind: 'curator',
    })
    await insertDecision(handle.db, {
      observationId: rejected,
      decision: 'rejected',
      decidedBy: userId,
    })
    expect(
      (await captureError(() => setCurrentDirect(handle.db, placeId, 'seating', rejected))).code,
    ).toBe(CHECK)

    // Accepted — succeeds.
    const accepted = await insertObservation(handle.db, {
      placeId,
      kind: 'seating',
      value: 'adequate',
      provenanceKind: 'curator',
    })
    await insertDecision(handle.db, {
      observationId: accepted,
      decision: 'accepted',
      decidedBy: userId,
    })
    await expect(setCurrentDirect(handle.db, placeId, 'seating', accepted)).resolves.toBeUndefined()
  })

  it('#18 a later accepting decision supersedes an earlier rejection', async () => {
    const placeId = await insertPlace(handle.db)
    const obs = await insertObservation(handle.db, {
      placeId,
      kind: 'power',
      value: 'abundant',
      provenanceKind: 'curator',
    })
    await insertDecision(handle.db, { observationId: obs, decision: 'rejected', decidedBy: userId })
    await insertDecision(handle.db, { observationId: obs, decision: 'accepted', decidedBy: userId })
    await expect(setCurrentDirect(handle.db, placeId, 'power', obs)).resolves.toBeUndefined()
  })
})
