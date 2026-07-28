import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { ATTRIBUTE_VALUES } from '@/lib/domain/attributes'
import type { DbHandle } from '@/lib/db/client'
import { captureError, insertObservation, insertPlace, insertUser, openTestDb } from './helpers'

// Covers required tests #7, #8, #9, #10, #11, #12, #13.
let handle: DbHandle
beforeAll(() => {
  handle = openTestDb()
})
afterAll(async () => {
  await handle.pool.end()
})

const CHECK = '23514'
const UNIQUE = '23505'

describe('places constraints', () => {
  it('#7 latitude/longitude ranges reject invalid coordinates', async () => {
    expect((await captureError(() => insertPlace(handle.db, { latitude: 91 }))).code).toBe(CHECK)
    expect((await captureError(() => insertPlace(handle.db, { latitude: -91 }))).code).toBe(CHECK)
    expect((await captureError(() => insertPlace(handle.db, { longitude: 181 }))).code).toBe(CHECK)
    expect((await captureError(() => insertPlace(handle.db, { longitude: -181 }))).code).toBe(CHECK)
    await expect(
      insertPlace(handle.db, { latitude: 43.65, longitude: -79.38 }),
    ).resolves.toBeTruthy()
  })

  it('#8 slug format and uniqueness are enforced', async () => {
    const badSlug = async (slug: string) =>
      handle.db.execute(sql`
        INSERT INTO places (slug, name, latitude, longitude) VALUES (${slug}, 'x', 43.6, -79.4)`)
    expect((await captureError(() => badSlug('Has Spaces'))).code).toBe(CHECK)
    expect((await captureError(() => badSlug('UPPER'))).code).toBe(CHECK)
    expect((await captureError(() => badSlug('trailing-'))).code).toBe(CHECK)
    expect((await captureError(() => badSlug('a'.repeat(200)))).code).toBe(CHECK)

    const slug = `ok-${randomUUID().slice(0, 8)}`
    await expect(badSlug(slug)).resolves.toBeTruthy()
    expect((await captureError(() => badSlug(slug))).code).toBe(UNIQUE)
  })

  it('#9 publication/record-state cross-checks hold', async () => {
    // published requires active
    expect(
      (
        await captureError(() =>
          insertPlace(handle.db, { publicationState: 'published', recordState: 'closed' }),
        )
      ).code,
    ).toBe(CHECK)
    // closed requires closed_at (insertPlace omits closed_at)
    expect((await captureError(() => insertPlace(handle.db, { recordState: 'closed' }))).code).toBe(
      CHECK,
    )
    // published + active is fine
    await expect(
      insertPlace(handle.db, { publicationState: 'published', recordState: 'active' }),
    ).resolves.toBeTruthy()
  })

  it('#10 duplicate self-reference and state rules hold', async () => {
    const survivor = await insertPlace(handle.db)
    // duplicate state requires duplicate_of_place_id
    expect(
      (await captureError(() => insertPlace(handle.db, { recordState: 'duplicate' }))).code,
    ).toBe(CHECK)
    // duplicate_of set while active is inconsistent
    expect(
      (
        await captureError(() =>
          handle.db.execute(sql`
            INSERT INTO places (slug, name, latitude, longitude, record_state, duplicate_of_place_id)
            VALUES (${`d-${randomUUID().slice(0, 8)}`}, 'x', 43.6, -79.4, 'active', ${survivor})`),
        )
      ).code,
    ).toBe(CHECK)
    // a place cannot duplicate itself
    const selfId = randomUUID()
    expect(
      (
        await captureError(() =>
          handle.db.execute(sql`
            INSERT INTO places (id, slug, name, latitude, longitude, record_state, duplicate_of_place_id)
            VALUES (${selfId}, ${`s-${selfId.slice(0, 8)}`}, 'x', 43.6, -79.4, 'duplicate', ${selfId})`),
        )
      ).code,
    ).toBe(CHECK)
    // a valid duplicate pointing at another place succeeds
    await expect(
      handle.db.execute(sql`
        INSERT INTO places (slug, name, latitude, longitude, record_state, duplicate_of_place_id)
        VALUES (${`v-${randomUUID().slice(0, 8)}`}, 'x', 43.6, -79.4, 'duplicate', ${survivor})`),
    ).resolves.toBeTruthy()
  })
})

describe('attribute kind/value matrix', () => {
  it('#11 every valid kind/value pair is accepted', async () => {
    const placeId = await insertPlace(handle.db)
    for (const [kind, values] of Object.entries(ATTRIBUTE_VALUES)) {
      for (const value of values) {
        await expect(
          insertObservation(handle.db, {
            placeId,
            kind: kind as keyof typeof ATTRIBUTE_VALUES,
            value,
            provenanceKind: 'curator',
          }),
          `${kind}/${value} should be accepted`,
        ).resolves.toBeTruthy()
      }
    }
  })

  it('#12 invalid cross-kind values are rejected at the database', async () => {
    const placeId = await insertPlace(handle.db)
    const operatorId = await insertUser(handle.db)
    // Include a valid operator identity so the ONLY possible violation is the
    // kind/value matrix (not the provenance-identity CHECK).
    const bad = async (kind: string, value: string) =>
      handle.db.execute(sql`
        INSERT INTO attribute_observations (place_id, kind, value, provenance_kind, confidence, observed_at, observed_by_operator_user_id)
        VALUES (${placeId}, ${kind}, ${value}, 'curator', 'medium', now(), ${operatorId})`)
    // 'abundant' is valid for power, not wifi.
    expect((await captureError(() => bad('wifi', 'abundant'))).code).toBe(CHECK)
    // 'lively' is valid for noise, not seating.
    expect((await captureError(() => bad('seating', 'lively'))).code).toBe(CHECK)
    // unknown kind entirely.
    expect((await captureError(() => bad('temperature', 'warm'))).code).toBe(CHECK)
  })

  it('#13 unknown is a distinct, valid value — never collapsed to none', async () => {
    const placeId = await insertPlace(handle.db)
    const unknownId = await insertObservation(handle.db, {
      placeId,
      kind: 'wifi',
      value: 'unknown',
      provenanceKind: 'curator',
    })
    const noneId = await insertObservation(handle.db, {
      placeId,
      kind: 'wifi',
      value: 'none',
      provenanceKind: 'curator',
    })
    const res = await handle.db.execute<{ id: string; value: string }>(sql`
      SELECT id, value FROM attribute_observations WHERE id IN (${unknownId}, ${noneId})
    `)
    const byId = Object.fromEntries(res.rows.map((r) => [r.id, r.value]))
    expect(byId[unknownId]).toBe('unknown')
    expect(byId[noneId]).toBe('none')
    expect(byId[unknownId]).not.toBe(byId[noneId])
  })
})
