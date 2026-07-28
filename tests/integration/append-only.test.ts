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
} from './helpers'

// Covers required tests #14, #15, #16. The append-only triggers RAISE with
// SQLSTATE 'restrict_violation' (23001).
const APPEND_ONLY = '23001'

let handle: DbHandle
beforeAll(() => {
  handle = openTestDb()
})
afterAll(async () => {
  await handle.pool.end()
})

describe('append-only enforcement', () => {
  it('#14 attribute_observations reject UPDATE and DELETE', async () => {
    const placeId = await insertPlace(handle.db)
    const obsId = await insertObservation(handle.db, {
      placeId,
      kind: 'wifi',
      value: 'usable',
      provenanceKind: 'curator',
    })
    expect(
      (
        await captureError(() =>
          handle.db.execute(
            sql`UPDATE attribute_observations SET value = 'fast' WHERE id = ${obsId}`,
          ),
        )
      ).code,
    ).toBe(APPEND_ONLY)
    expect(
      (
        await captureError(() =>
          handle.db.execute(sql`DELETE FROM attribute_observations WHERE id = ${obsId}`),
        )
      ).code,
    ).toBe(APPEND_ONLY)
  })

  it('#15 attribute_observation_decisions reject UPDATE and DELETE', async () => {
    const userId = await insertUser(handle.db)
    const placeId = await insertPlace(handle.db)
    const obsId = await insertObservation(handle.db, {
      placeId,
      kind: 'power',
      value: 'available',
      provenanceKind: 'curator',
    })
    const decisionId = await insertDecision(handle.db, {
      observationId: obsId,
      decision: 'accepted',
      decidedBy: userId,
    })
    expect(
      (
        await captureError(() =>
          handle.db.execute(
            sql`UPDATE attribute_observation_decisions SET decision = 'rejected' WHERE id = ${decisionId}`,
          ),
        )
      ).code,
    ).toBe(APPEND_ONLY)
    expect(
      (
        await captureError(() =>
          handle.db.execute(
            sql`DELETE FROM attribute_observation_decisions WHERE id = ${decisionId}`,
          ),
        )
      ).code,
    ).toBe(APPEND_ONLY)
  })

  it('#16 curation_events reject UPDATE and DELETE', async () => {
    const placeId = await insertPlace(handle.db)
    const res = await handle.db.execute<{ id: string }>(sql`
      INSERT INTO curation_events (event_type, place_id, actor_kind)
      VALUES ('place_created', ${placeId}, 'system') RETURNING id
    `)
    const eventId = res.rows[0].id
    expect(
      (
        await captureError(() =>
          handle.db.execute(sql`UPDATE curation_events SET reason = 'x' WHERE id = ${eventId}`),
        )
      ).code,
    ).toBe(APPEND_ONLY)
    expect(
      (
        await captureError(() =>
          handle.db.execute(sql`DELETE FROM curation_events WHERE id = ${eventId}`),
        )
      ).code,
    ).toBe(APPEND_ONLY)
  })
})
