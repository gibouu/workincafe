import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createCafe } from '@/lib/application/places/create-cafe'
import { setCafePublication } from '@/lib/application/places/set-cafe-publication'
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
  it('publishes an active draft and logs place_published', async () => {
    const created = await createCafe(baseInput(`cafe-${randomUUID()}`), actor, handle.db)
    if (created.status !== 'created') throw new Error('setup failed')
    const result = await setCafePublication(created.id, 'published', actor, handle.db)
    expect(result.status).toBe('updated')
    expect((await placeRow(created.id)).publication_state).toBe('published')
    expect(await eventCount(created.id, 'place_published')).toBe(1)
  })

  it('hides a published café and logs place_hidden', async () => {
    const created = await createCafe(baseInput(`cafe-${randomUUID()}`), actor, handle.db)
    if (created.status !== 'created') throw new Error('setup failed')
    await setCafePublication(created.id, 'published', actor, handle.db)
    const result = await setCafePublication(created.id, 'hidden', actor, handle.db)
    expect(result.status).toBe('updated')
    expect((await placeRow(created.id)).publication_state).toBe('hidden')
    expect(await eventCount(created.id, 'place_hidden')).toBe(1)
  })

  it('is a no-op when already in the target state (no duplicate event)', async () => {
    const created = await createCafe(baseInput(`cafe-${randomUUID()}`), actor, handle.db)
    if (created.status !== 'created') throw new Error('setup failed')
    await setCafePublication(created.id, 'published', actor, handle.db)
    const again = await setCafePublication(created.id, 'published', actor, handle.db)
    expect(again.status).toBe('unchanged')
    expect(await eventCount(created.id, 'place_published')).toBe(1)
  })
})
