import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { recordAttributeObservation } from '@/lib/application/attributes/record-attribute-observation'
import { setCafeHours } from '@/lib/application/hours/set-cafe-hours'
import type { DbHandle } from '@/lib/db/client'
import { unknownWeeklyHours, type WeeklyHoursV1 } from '@/lib/domain/hours'
import { insertOperator, insertPlace, insertSourceRef, insertUser, openTestDb } from './helpers'

// Step 4 operator-curation slice: the two new write paths end-to-end against the
// real database. Recording appends immutable curator evidence + the operator's
// accepted decision and promotes it through the promotion use case (pointer +
// `attribute_promoted` event); saving hours upserts the single current row
// paired with its `hours_updated` event — each path in one transaction.

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

const VALID_OBSERVATION = {
  kind: 'wifi',
  value: 'fast',
  confidence: 'high',
  observedAt: '2026-07-01',
  note: 'measured during a weekday afternoon',
}

async function countEvents(placeId: string, eventType: string): Promise<number> {
  const res = await handle.db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM curation_events WHERE place_id = ${placeId} AND event_type = ${eventType}
  `)
  return res.rows[0].n
}

describe('recordAttributeObservation (transactional)', () => {
  it('records curator evidence, an accepted decision, the pointer, and the promotion event', async () => {
    const placeId = await insertPlace(handle.db)

    const result = await recordAttributeObservation(
      { ...VALID_OBSERVATION, placeId },
      operatorId,
      handle.db,
    )
    expect(result).toEqual({ status: 'recorded' })

    const obs = await handle.db.execute<{
      id: string
      value: string
      provenance_kind: string
      confidence: string
      observed_by_operator_user_id: string
      note: string
    }>(sql`
      SELECT id, value, provenance_kind, confidence, observed_by_operator_user_id, note
      FROM attribute_observations WHERE place_id = ${placeId} AND kind = 'wifi'
    `)
    expect(obs.rows).toHaveLength(1)
    expect(obs.rows[0].value).toBe('fast')
    expect(obs.rows[0].provenance_kind).toBe('curator')
    expect(obs.rows[0].confidence).toBe('high')
    expect(obs.rows[0].observed_by_operator_user_id).toBe(operatorId)
    expect(obs.rows[0].note).toBe('measured during a weekday afternoon')

    const decision = await handle.db.execute<{ decision: string; decided: string }>(sql`
      SELECT decision, decided_by_operator_user_id AS decided
      FROM attribute_observation_decisions WHERE observation_id = ${obs.rows[0].id}
    `)
    expect(decision.rows).toEqual([{ decision: 'accepted', decided: operatorId }])

    const current = await handle.db.execute<{ current_observation_id: string }>(sql`
      SELECT current_observation_id FROM place_attribute_current
      WHERE place_id = ${placeId} AND kind = 'wifi'
    `)
    expect(current.rows[0]?.current_observation_id).toBe(obs.rows[0].id)

    const events = await handle.db.execute<{ actor_kind: string; actor_user_id: string }>(sql`
      SELECT actor_kind, actor_user_id FROM curation_events
      WHERE place_id = ${placeId} AND event_type = 'attribute_promoted'
    `)
    expect(events.rows).toEqual([{ actor_kind: 'operator', actor_user_id: operatorId }])
  })

  it('a second recording of the same kind repoints to the newest evidence', async () => {
    const placeId = await insertPlace(handle.db)
    await recordAttributeObservation({ ...VALID_OBSERVATION, placeId }, operatorId, handle.db)
    const second = await recordAttributeObservation(
      { ...VALID_OBSERVATION, placeId, value: 'unreliable', note: '' },
      operatorId,
      handle.db,
    )
    expect(second).toEqual({ status: 'recorded' })

    const current = await handle.db.execute<{ value: string }>(sql`
      SELECT o.value FROM place_attribute_current c
      JOIN attribute_observations o ON o.id = c.current_observation_id
      WHERE c.place_id = ${placeId} AND c.kind = 'wifi'
    `)
    expect(current.rows[0].value).toBe('unreliable')

    const res = await handle.db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM attribute_observations WHERE place_id = ${placeId}
    `)
    expect(res.rows[0].n).toBe(2)
    expect(await countEvents(placeId, 'attribute_promoted')).toBe(2)
  })

  it('rejects a cross-kind value without writing anything', async () => {
    const placeId = await insertPlace(handle.db)
    const result = await recordAttributeObservation(
      { ...VALID_OBSERVATION, placeId, value: 'abundant' },
      operatorId,
      handle.db,
    )
    expect(result.status).toBe('invalid')
    const res = await handle.db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM attribute_observations WHERE place_id = ${placeId}
    `)
    expect(res.rows[0].n).toBe(0)
  })

  it('does not record evidence against a non-active record', async () => {
    const placeId = await insertPlace(handle.db)
    await handle.db.execute(
      sql`UPDATE places SET record_state = 'closed', closed_at = now() WHERE id = ${placeId}`,
    )
    const result = await recordAttributeObservation(
      { ...VALID_OBSERVATION, placeId },
      operatorId,
      handle.db,
    )
    expect(result).toEqual({ status: 'not_found' })
  })
})

function openWeek(): WeeklyHoursV1 {
  const schedule = unknownWeeklyHours()
  return {
    ...schedule,
    days: {
      ...schedule.days,
      monday: {
        state: 'open',
        intervals: [{ opens: '08:00', closes: '17:00', closesDayOffset: 0 }],
      },
      tuesday: { state: 'closed' },
    },
  }
}

describe('setCafeHours (transactional)', () => {
  it('creates the hours row as curator-verified with its hours_updated event', async () => {
    const placeId = await insertPlace(handle.db)
    const result = await setCafeHours(
      { placeId, confidence: 'medium', schedule: openWeek() },
      operatorId,
      handle.db,
    )
    expect(result).toEqual({ status: 'saved' })

    const row = await handle.db.execute<{
      schedule: WeeklyHoursV1
      provenance_kind: string
      source_ref_id: string | null
      confidence: string
      verified_by_operator_user_id: string
    }>(sql`
      SELECT schedule, provenance_kind, source_ref_id, confidence, verified_by_operator_user_id
      FROM place_hours WHERE place_id = ${placeId}
    `)
    expect(row.rows).toHaveLength(1)
    expect(row.rows[0].provenance_kind).toBe('curator')
    expect(row.rows[0].source_ref_id).toBeNull()
    expect(row.rows[0].confidence).toBe('medium')
    expect(row.rows[0].verified_by_operator_user_id).toBe(operatorId)
    expect(row.rows[0].schedule.days.monday).toEqual({
      state: 'open',
      intervals: [{ opens: '08:00', closes: '17:00', closesDayOffset: 0 }],
    })
    expect(row.rows[0].schedule.days.tuesday).toEqual({ state: 'closed' })
    expect(row.rows[0].schedule.days.wednesday).toEqual({ state: 'unknown' })

    expect(await countEvents(placeId, 'hours_updated')).toBe(1)
  })

  it('a later save updates the single row (curator supersedes an import) and appends another event', async () => {
    const placeId = await insertPlace(handle.db)
    const sourceRefId = await insertSourceRef(handle.db, placeId)
    await handle.db.execute(sql`
      INSERT INTO place_hours (place_id, schedule, provenance_kind, source_ref_id, confidence)
      VALUES (${placeId}, ${JSON.stringify(unknownWeeklyHours())}::jsonb, 'imported', ${sourceRefId}, 'low')
    `)

    const result = await setCafeHours(
      { placeId, confidence: 'high', schedule: openWeek() },
      operatorId,
      handle.db,
    )
    expect(result).toEqual({ status: 'saved' })

    const rows = await handle.db.execute<{ provenance_kind: string; source_ref_id: string | null }>(
      sql`SELECT provenance_kind, source_ref_id FROM place_hours WHERE place_id = ${placeId}`,
    )
    expect(rows.rows).toEqual([{ provenance_kind: 'curator', source_ref_id: null }])
    expect(await countEvents(placeId, 'hours_updated')).toBe(1)
  })

  it('rejects an invalid schedule without writing anything', async () => {
    const placeId = await insertPlace(handle.db)
    const schedule = openWeek()
    schedule.days.monday = {
      state: 'open',
      intervals: [{ opens: '17:00', closes: '08:00', closesDayOffset: 0 }],
    }
    const result = await setCafeHours(
      { placeId, confidence: 'medium', schedule },
      operatorId,
      handle.db,
    )
    expect(result.status).toBe('invalid')
    const res = await handle.db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM place_hours WHERE place_id = ${placeId}`,
    )
    expect(res.rows[0].n).toBe(0)
  })

  it('does not save hours for a non-active record', async () => {
    const placeId = await insertPlace(handle.db)
    await handle.db.execute(
      sql`UPDATE places SET record_state = 'closed', closed_at = now() WHERE id = ${placeId}`,
    )
    const result = await setCafeHours(
      { placeId, confidence: 'medium', schedule: unknownWeeklyHours() },
      operatorId,
      handle.db,
    )
    expect(result).toEqual({ status: 'not_found' })
    expect(await countEvents(placeId, 'hours_updated')).toBe(0)
  })
})
