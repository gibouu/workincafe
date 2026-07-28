import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type { DbHandle } from '@/lib/db/client'
import { captureError, insertPlace, openTestDb } from './helpers'

// Covers required tests #4, #5, #6.
let handle: DbHandle
beforeAll(() => {
  handle = openTestDb()
})
afterAll(async () => {
  await handle.pool.end()
})

describe('spatial', () => {
  it('#4 generated geography is derived correctly from lat/lng', async () => {
    const id = await insertPlace(handle.db, { latitude: 43.6532, longitude: -79.3832 })
    const res = await handle.db.execute<{ wkt: string; srid: number; dist: number }>(sql`
      SELECT ST_AsText(geog::geometry) AS wkt,
             ST_SRID(geog::geometry) AS srid,
             round(ST_Distance(geog, ST_SetSRID(ST_MakePoint(-79.3832, 43.6622), 4326)::geography)::numeric, 0)::float8 AS dist
      FROM places WHERE id = ${id}
    `)
    expect(res.rows[0].wkt).toBe('POINT(-79.3832 43.6532)')
    expect(res.rows[0].srid).toBe(4326)
    // ~0.009° of latitude ≈ 1 km.
    expect(res.rows[0].dist).toBeGreaterThan(950)
    expect(res.rows[0].dist).toBeLessThan(1050)
  })

  it('#4 geog is generated — it cannot be written directly', async () => {
    const id = randomUUID()
    const err = await captureError(() =>
      handle.db.execute(sql`
        INSERT INTO places (id, slug, name, latitude, longitude, geog)
        VALUES (${id}, ${`p-${id.slice(0, 8)}`}, 'x', 43.6, -79.4,
                ST_SetSRID(ST_MakePoint(-79.4, 43.6), 4326)::geography)
      `),
    )
    // 428C9 = ERRCODE_GENERATED_ALWAYS (cannot insert into a generated column).
    expect(err.code === '428C9' || /generated/i.test(err.message)).toBe(true)
  })

  it('#5 the GiST index on geog is usable by the planner', async () => {
    // At tiny row counts the planner may prefer a seqscan; disabling it (within
    // one transaction so SET LOCAL sticks) proves the index is eligible for a
    // representative proximity query.
    const plan = await handle.db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL enable_seqscan = off`)
      const res = await tx.execute<{ 'QUERY PLAN': string }>(sql`
        EXPLAIN (COSTS OFF)
        SELECT id FROM places
        WHERE ST_DWithin(geog, ST_SetSRID(ST_MakePoint(-79.3832, 43.6532), 4326)::geography, 500)
      `)
      return res.rows.map((r) => r['QUERY PLAN']).join('\n')
    })
    expect(plan).toContain('places_geog_gist')
  })

  it('#6 service-area containment works with a deterministic fixture polygon', async () => {
    // A ~small square around downtown Toronto (lng/lat order in WKT).
    const code = `fx-${randomUUID().slice(0, 8)}`
    await handle.db.execute(sql`
      INSERT INTO service_areas (code, name, geometry)
      VALUES (${code}, 'Fixture', ST_GeomFromText(
        'MULTIPOLYGON(((-79.42 43.63, -79.35 43.63, -79.35 43.70, -79.42 43.70, -79.42 43.63)))', 4326))
    `)
    const inside = await insertPlace(handle.db, { latitude: 43.6532, longitude: -79.3832 })
    const outside = await insertPlace(handle.db, { latitude: 43.7615, longitude: -79.4111 })
    const res = await handle.db.execute<{ id: string }>(sql`
      SELECT p.id FROM places p
      JOIN service_areas s ON s.code = ${code}
      WHERE ST_Covers(s.geometry, p.geog::geometry) AND p.id IN (${inside}, ${outside})
    `)
    const contained = res.rows.map((r) => r.id)
    expect(contained).toContain(inside)
    expect(contained).not.toContain(outside)
  })
})
