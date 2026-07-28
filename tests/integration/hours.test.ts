import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { HOURS_TIME_ZONE } from '@/lib/domain/hours'
import type { DbHandle } from '@/lib/db/client'
import { captureError, insertPlace, insertUser, openTestDb } from './helpers'

// Covers required test #21 at the database structural level (full schedule
// validation is Zod's job — see tests/unit/hours.test.ts). The database enforces
// only stable structural checks: object, version = 1, required keys, size bound.
const CHECK = '23514'

let handle: DbHandle
let operatorId: string
beforeAll(async () => {
  handle = openTestDb()
  operatorId = await insertUser(handle.db)
})
afterAll(async () => {
  await handle.pool.end()
})

// Curator hours require a verifying operator identity (provenance-identity CHECK).
async function insertHours(placeId: string, schedule: unknown) {
  return handle.db.execute(sql`
    INSERT INTO place_hours (place_id, schedule, provenance_kind, confidence, verified_by_operator_user_id)
    VALUES (${placeId}, ${JSON.stringify(schedule)}::jsonb, 'curator', 'medium', ${operatorId})
  `)
}

const validSchedule = {
  version: 1,
  timeZone: HOURS_TIME_ZONE,
  days: {
    monday: { state: 'open', intervals: [{ opens: '08:00', closes: '22:00', closesDayOffset: 0 }] },
    tuesday: {
      state: 'open',
      intervals: [{ opens: '08:00', closes: '22:00', closesDayOffset: 0 }],
    },
    wednesday: { state: 'unknown' },
    thursday: { state: 'closed' },
    friday: { state: 'open', intervals: [{ opens: '08:00', closes: '01:00', closesDayOffset: 1 }] },
    saturday: { state: 'closed' },
    sunday: { state: 'unknown' },
  },
}

describe('place_hours structural checks', () => {
  it('#21 a valid schedule distinguishing unknown/closed/open is accepted and round-trips', async () => {
    const placeId = await insertPlace(handle.db)
    await expect(insertHours(placeId, validSchedule)).resolves.toBeTruthy()
    const res = await handle.db.execute<{ schedule: typeof validSchedule }>(
      sql`SELECT schedule FROM place_hours WHERE place_id = ${placeId}`,
    )
    const stored = res.rows[0].schedule
    expect(stored.days.wednesday.state).toBe('unknown')
    expect(stored.days.thursday.state).toBe('closed')
    expect(stored.days.monday.state).toBe('open')
  })

  it('rejects a non-object schedule', async () => {
    const placeId = await insertPlace(handle.db)
    expect((await captureError(() => insertHours(placeId, [1, 2, 3]))).code).toBe(CHECK)
  })

  it('rejects a wrong schema version', async () => {
    const placeId = await insertPlace(handle.db)
    expect(
      (await captureError(() => insertHours(placeId, { ...validSchedule, version: 2 }))).code,
    ).toBe(CHECK)
  })

  it('rejects a schedule missing required keys', async () => {
    const placeId = await insertPlace(handle.db)
    expect(
      (await captureError(() => insertHours(placeId, { version: 1, timeZone: HOURS_TIME_ZONE })))
        .code,
    ).toBe(CHECK)
  })
})
