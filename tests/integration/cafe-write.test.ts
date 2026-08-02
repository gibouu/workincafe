import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createCafe } from '@/lib/application/places/create-cafe'
import { setCafePublication } from '@/lib/application/places/set-cafe-publication'
import { setCafeHours } from '@/lib/application/hours/set-cafe-hours'
import { DAY_KEYS, HOURS_SCHEMA_VERSION, HOURS_TIME_ZONE } from '@/lib/domain/hours'
import type { DbHandle } from '@/lib/db/client'
import { insertOperator, insertUser, openTestDb } from './helpers'

// Operator café-creation + publication transitions (Step 4 operator-write
// slice). Exercises the real database: draft/active defaults, the append-only
// curation-event trail written in the same transaction, slug uniqueness, and
// input validation.
let handle: DbHandle
let actor: string

beforeAll(async () => {
  handle = openTestDb()
  actor = await insertUser(handle.db)
  await insertOperator(handle.db, actor, true)
})
afterAll(async () => {
  await handle.pool.end()
})

/** All seven days known (closed) — satisfies the source/15 publication gate. */
async function seedCompleteHours(placeId: string) {
  const days = Object.fromEntries(DAY_KEYS.map((d) => [d, { state: 'closed' }]))
  const result = await setCafeHours(
    {
      placeId,
      confidence: 'medium',
      schedule: { version: HOURS_SCHEMA_VERSION, timeZone: HOURS_TIME_ZONE, days },
    },
    actor,
    handle.db,
  )
  if (result.status !== 'saved') throw new Error(`seedCompleteHours: ${result.status}`)
}

function baseInput(slug: string) {
  return { name: 'Test Café', slug, latitude: 43.6532, longitude: -79.3832 }
}

async function placeRow(id: string) {
  const res = await handle.db.execute<{
    publication_state: string
    record_state: string
  }>(sql`SELECT publication_state, record_state FROM places WHERE id = ${id}`)
  return res.rows[0]
}

async function eventCount(placeId: string, type: string) {
  const res = await handle.db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM curation_events
    WHERE place_id = ${placeId} AND event_type = ${type} AND actor_kind = 'operator'
  `)
  return res.rows[0].n
}

describe('createCafe', () => {
  it('creates a draft, active café and logs place_created', async () => {
    const result = await createCafe(baseInput(`cafe-${randomUUID()}`), actor, handle.db)
    expect(result.status).toBe('created')
    if (result.status !== 'created') return
    const row = await placeRow(result.id)
    expect(row).toMatchObject({ publication_state: 'draft', record_state: 'active' })
    expect(await eventCount(result.id, 'place_created')).toBe(1)
  })

  it('rejects a duplicate slug as an expected outcome (not a throw)', async () => {
    const slug = `cafe-${randomUUID()}`
    const first = await createCafe(baseInput(slug), actor, handle.db)
    expect(first.status).toBe('created')
    const second = await createCafe(baseInput(slug), actor, handle.db)
    expect(second.status).toBe('slug_taken')
  })

  it('rejects invalid input with a message', async () => {
    const result = await createCafe(
      { ...baseInput('Not A Slug'), slug: 'Not A Slug' },
      actor,
      handle.db,
    )
    expect(result.status).toBe('invalid')
  })
})

describe('setCafePublication', () => {
  it('publish is blocked without complete hours (source/15) and unblocks once known', async () => {
    const created = await createCafe(baseInput(`hrs-${randomUUID().slice(0, 8)}`), actor, handle.db)
    if (created.status !== 'created') throw new Error('setup')

    // No hours at all → unchanged, no event.
    let result = await setCafePublication(created.id, 'published', actor, handle.db)
    expect(result).toEqual({ status: 'unchanged' })
    expect((await placeRow(created.id)).publication_state).toBe('draft')

    // Hours with one unknown day → still blocked.
    const days = Object.fromEntries(DAY_KEYS.map((d) => [d, { state: 'closed' }]))
    days.sunday = { state: 'unknown' }
    await setCafeHours(
      {
        placeId: created.id,
        confidence: 'medium',
        schedule: { version: HOURS_SCHEMA_VERSION, timeZone: HOURS_TIME_ZONE, days },
      },
      actor,
      handle.db,
    )
    result = await setCafePublication(created.id, 'published', actor, handle.db)
    expect(result).toEqual({ status: 'unchanged' })

    // All seven days known → publishes.
    await seedCompleteHours(created.id)
    result = await setCafePublication(created.id, 'published', actor, handle.db)
    expect(result).toEqual({ status: 'updated' })
    expect((await placeRow(created.id)).publication_state).toBe('published')
  })

  it('publishes an active draft and logs place_published', async () => {
    const created = await createCafe(baseInput(`cafe-${randomUUID()}`), actor, handle.db)
    if (created.status !== 'created') throw new Error('setup failed')
    await seedCompleteHours(created.id)
    const result = await setCafePublication(created.id, 'published', actor, handle.db)
    expect(result.status).toBe('updated')
    expect((await placeRow(created.id)).publication_state).toBe('published')
    expect(await eventCount(created.id, 'place_published')).toBe(1)
  })

  it('hides a published café and logs place_hidden', async () => {
    const created = await createCafe(baseInput(`cafe-${randomUUID()}`), actor, handle.db)
    if (created.status !== 'created') throw new Error('setup failed')
    await seedCompleteHours(created.id)
    await setCafePublication(created.id, 'published', actor, handle.db)
    const result = await setCafePublication(created.id, 'hidden', actor, handle.db)
    expect(result.status).toBe('updated')
    expect((await placeRow(created.id)).publication_state).toBe('hidden')
    expect(await eventCount(created.id, 'place_hidden')).toBe(1)
  })

  it('is a no-op when already in the target state (no duplicate event)', async () => {
    const created = await createCafe(baseInput(`cafe-${randomUUID()}`), actor, handle.db)
    if (created.status !== 'created') throw new Error('setup failed')
    await seedCompleteHours(created.id)
    await setCafePublication(created.id, 'published', actor, handle.db)
    const again = await setCafePublication(created.id, 'published', actor, handle.db)
    expect(again.status).toBe('unchanged')
    expect(await eventCount(created.id, 'place_published')).toBe(1)
  })
})
