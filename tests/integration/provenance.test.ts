import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { unknownWeeklyHours } from '@/lib/domain/hours'
import type { DbHandle } from '@/lib/db/client'
import { captureError, insertPlace, insertSourceRef, insertUser, openTestDb } from './helpers'

// Provenance identity is structurally enforced (Step 3B strict-gate amendment):
// provenance can never be structurally possible but unidentified. CHECK
// violations surface as SQLSTATE 23514.
const CHECK = '23514'

let handle: DbHandle
let userId: string
let placeId: string
let sourceRefId: string
beforeAll(async () => {
  handle = openTestDb()
  userId = await insertUser(handle.db)
  placeId = await insertPlace(handle.db)
  sourceRefId = await insertSourceRef(handle.db, placeId)
})
afterAll(async () => {
  await handle.pool.end()
})

function insertObs(prov: string, source: string | null, operator: string | null) {
  return handle.db.execute(sql`
    INSERT INTO attribute_observations
      (place_id, kind, value, provenance_kind, confidence, observed_at, source_ref_id, observed_by_operator_user_id)
    VALUES (${placeId}, 'wifi', 'usable', ${prov}, 'medium', now(), ${source}, ${operator})`)
}

async function insertHoursRow(prov: string, useSource: boolean, useOperator: boolean) {
  const pid = await insertPlace(handle.db)
  const src = useSource ? await insertSourceRef(handle.db, pid) : null
  const op = useOperator ? userId : null
  return handle.db.execute(sql`
    INSERT INTO place_hours (place_id, schedule, provenance_kind, confidence, source_ref_id, verified_by_operator_user_id)
    VALUES (${pid}, ${JSON.stringify(unknownWeeklyHours())}::jsonb, ${prov}, 'medium', ${src}, ${op})`)
}

describe('attribute observation provenance identity', () => {
  it('imported observation requires a source reference', async () => {
    expect((await captureError(() => insertObs('imported', null, null))).code).toBe(CHECK)
    await expect(insertObs('imported', sourceRefId, null)).resolves.toBeTruthy()
  })

  it('curator observation requires an operator identity', async () => {
    expect((await captureError(() => insertObs('curator', null, null))).code).toBe(CHECK)
    await expect(insertObs('curator', null, userId)).resolves.toBeTruthy()
  })

  it('measurement observation requires an operator identity (launch model)', async () => {
    expect((await captureError(() => insertObs('measurement', null, null))).code).toBe(CHECK)
    await expect(insertObs('measurement', null, userId)).resolves.toBeTruthy()
  })
})

describe('place_hours provenance identity', () => {
  it('imported hours require a source reference', async () => {
    expect((await captureError(() => insertHoursRow('imported', false, false))).code).toBe(CHECK)
    await expect(insertHoursRow('imported', true, false)).resolves.toBeTruthy()
  })

  it('curator hours require an operator identity', async () => {
    expect((await captureError(() => insertHoursRow('curator', false, false))).code).toBe(CHECK)
    await expect(insertHoursRow('curator', false, true)).resolves.toBeTruthy()
  })

  it('measurement hours require an operator identity', async () => {
    expect((await captureError(() => insertHoursRow('measurement', false, false))).code).toBe(CHECK)
    await expect(insertHoursRow('measurement', false, true)).resolves.toBeTruthy()
  })
})
