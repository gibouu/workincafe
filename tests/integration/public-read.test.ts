import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { unknownWeeklyHours } from '@/lib/domain/hours'
import { getPublishedCafeBySlug } from '@/lib/application/places/get-published-cafe'
import { listPublishedCafes } from '@/lib/application/places/list-published-cafes'
import type { DbHandle } from '@/lib/db/client'
import { insertPlace, insertUser, openTestDb, seedAcceptedCurrent } from './helpers'

// Slice A read-path integration: published-only, unknown defaulting, by-slug,
// and the spatial radius filter — through the real use cases against PostGIS.
let handle: DbHandle
let operatorId: string
beforeAll(async () => {
  handle = openTestDb()
  operatorId = await insertUser(handle.db)
})
afterAll(async () => {
  await handle.pool.end()
})

const slugFor = (id: string) => `p-${id.slice(0, 8)}`

describe('listPublishedCafes', () => {
  it('returns only published+active cafés, with current attributes; missing kinds are unknown', async () => {
    const published = await insertPlace(handle.db, {
      publicationState: 'published',
      recordState: 'active',
      latitude: 43.6516,
      longitude: -79.3792,
    })
    await seedAcceptedCurrent(handle.db, {
      placeId: published,
      kind: 'wifi',
      value: 'fast',
      provenanceKind: 'curator',
      operatorUserId: operatorId,
    })
    await seedAcceptedCurrent(handle.db, {
      placeId: published,
      kind: 'noise',
      value: 'quiet',
      provenanceKind: 'curator',
      operatorUserId: operatorId,
    })
    const draft = await insertPlace(handle.db, { publicationState: 'draft' })
    await seedAcceptedCurrent(handle.db, {
      placeId: draft,
      kind: 'wifi',
      value: 'fast',
      provenanceKind: 'curator',
      operatorUserId: operatorId,
    })

    const list = await listPublishedCafes({}, handle.db)
    const ids = list.map((c) => c.id)
    expect(ids).toContain(published)
    expect(ids).not.toContain(draft)

    const row = list.find((c) => c.id === published)
    expect(row?.attributes.wifi).toBe('fast')
    expect(row?.attributes.noise).toBe('quiet')
    expect(row?.attributes.power).toBe('unknown')
    expect(row?.attributes.seating).toBe('unknown')
  })

  it('radius filter returns nearby published cafés and excludes far ones', async () => {
    const near = await insertPlace(handle.db, {
      publicationState: 'published',
      recordState: 'active',
      latitude: 43.6516,
      longitude: -79.3792,
    })
    const far = await insertPlace(handle.db, {
      publicationState: 'published',
      recordState: 'active',
      latitude: 43.7615,
      longitude: -79.4111,
    })
    const list = await listPublishedCafes(
      { near: { longitude: -79.3792, latitude: 43.6516, radiusMeters: 1000 } },
      handle.db,
    )
    const ids = list.map((c) => c.id)
    expect(ids).toContain(near)
    expect(ids).not.toContain(far)
  })
})

describe('getPublishedCafeBySlug', () => {
  it('returns detail with attribute details + hours for a published café', async () => {
    const id = await insertPlace(handle.db, {
      publicationState: 'published',
      recordState: 'active',
    })
    await seedAcceptedCurrent(handle.db, {
      placeId: id,
      kind: 'power',
      value: 'available',
      provenanceKind: 'curator',
      operatorUserId: operatorId,
    })
    await handle.db.execute(sql`
      INSERT INTO place_hours (place_id, schedule, provenance_kind, confidence, verified_by_operator_user_id)
      VALUES (${id}, ${JSON.stringify(unknownWeeklyHours())}::jsonb, 'curator', 'medium', ${operatorId})`)

    const detail = await getPublishedCafeBySlug(slugFor(id), handle.db)
    expect(detail?.slug).toBe(slugFor(id))
    expect(detail?.attributes.power).toBe('available')
    expect(detail?.attributeDetails.power.provenance).toBe('curator')
    expect(detail?.attributeDetails.seating.value).toBe('unknown')
    expect(detail?.hours?.version).toBe(1)
  })

  it('returns null for a draft slug and an unknown slug', async () => {
    const draft = await insertPlace(handle.db, { publicationState: 'draft' })
    expect(await getPublishedCafeBySlug(slugFor(draft), handle.db)).toBeNull()
    expect(await getPublishedCafeBySlug('no-such-cafe', handle.db)).toBeNull()
  })
})
