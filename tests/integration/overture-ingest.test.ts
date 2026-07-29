import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import type { DbHandle } from '@/lib/db/client'
import { ingestOvertureExtract } from '@/lib/ingestion/overture-index'
import { importServiceArea } from '@/lib/ingestion/service-area'
import { openTestDb } from './helpers'

// Slice 2 pt.1: the Overture matching-index refresh and the service-area
// boundary import, end-to-end against the real database. Refreshes are
// idempotent upserts (never duplicates, never deletes); the service area is a
// PostGIS-validated upsert by code.

let handle: DbHandle
beforeAll(() => {
  handle = openTestDb()
})
afterAll(async () => {
  await handle.pool.end()
})

function extractLine(id: string, name: string, lng = -79.4, lat = 43.65): string {
  return JSON.stringify({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: {
      id,
      names: { primary: name },
      categories: { primary: 'coffee_shop', alternate: [] },
      confidence: 0.9,
    },
  })
}

describe('ingestOvertureExtract (matching index refresh)', () => {
  it('loads valid lines, skips invalid ones, and dedups within the batch', async () => {
    const lines = [
      extractLine('ing-a', 'Cafe One'),
      extractLine('ing-b', 'Cafe Two'),
      extractLine('ing-b', 'Cafe Two Corrected'),
      '',
      '{broken',
      JSON.stringify({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-79.4, 43.65] },
        properties: {},
      }),
    ]
    const summary = await ingestOvertureExtract(handle.db, lines, { sourceVersion: 'test-1' })

    expect(summary.linesRead).toBe(6)
    expect(summary.loaded).toBe(2)
    expect(summary.inserted).toBe(2)
    expect(summary.updated).toBe(0)
    expect(summary.skipped.empty_line).toBe(1)
    expect(summary.skipped.invalid_json).toBe(1)
    expect(summary.skipped.missing_id_or_name).toBe(1)

    const row = await handle.db.execute<{ name: string; source_version: string }>(
      sql`SELECT name, source_version FROM overture_places WHERE gers_id = 'ing-b'`,
    )
    expect(row.rows).toEqual([{ name: 'Cafe Two Corrected', source_version: 'test-1' }])
  })

  it('a re-import updates in place — no duplicates, new source version stamped', async () => {
    const first = await ingestOvertureExtract(handle.db, [extractLine('ing-r', 'Original')], {
      sourceVersion: 'test-1',
    })
    expect(first.inserted).toBe(1)

    const second = await ingestOvertureExtract(handle.db, [extractLine('ing-r', 'Renamed')], {
      sourceVersion: 'test-2',
    })
    expect(second.inserted).toBe(0)
    expect(second.updated).toBe(1)

    const rows = await handle.db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM overture_places WHERE gers_id = 'ing-r'`,
    )
    expect(rows.rows[0].n).toBe(1)
    const row = await handle.db.execute<{ name: string; source_version: string }>(
      sql`SELECT name, source_version FROM overture_places WHERE gers_id = 'ing-r'`,
    )
    expect(row.rows[0]).toEqual({ name: 'Renamed', source_version: 'test-2' })
  })

  it('dry-run parses and counts without writing', async () => {
    const summary = await ingestOvertureExtract(handle.db, [extractLine('ing-dry', 'Dry Run')], {
      sourceVersion: 'test-1',
      dryRun: true,
    })
    expect(summary.loaded).toBe(1)
    expect(summary.inserted).toBe(0)
    const rows = await handle.db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM overture_places WHERE gers_id = 'ing-dry'`,
    )
    expect(rows.rows[0].n).toBe(0)
  })

  it('the generated geography column tracks lat/lng for proximity queries', async () => {
    await ingestOvertureExtract(handle.db, [extractLine('ing-geo', 'Geo Cafe', -79.38, 43.65)], {
      sourceVersion: 'test-1',
    })
    const res = await handle.db.execute<{ d: number }>(sql`
      SELECT ST_Distance(geog, ST_SetSRID(ST_MakePoint(-79.38, 43.65), 4326)::geography) AS d
      FROM overture_places WHERE gers_id = 'ing-geo'
    `)
    expect(res.rows[0].d).toBe(0)
  })
})

const TORONTO_ISH_POLYGON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-79.6, 43.55],
            [-79.1, 43.55],
            [-79.1, 43.9],
            [-79.6, 43.9],
            [-79.6, 43.55],
          ],
        ],
      },
    },
  ],
}

describe('importServiceArea (boundary import)', () => {
  const input = {
    code: 'test-area',
    name: 'Test Area',
    source: 'toronto_open_data',
    sourceVersion: 'v1',
  }

  it('imports a FeatureCollection boundary and upserts on re-import', async () => {
    const first = await importServiceArea(handle.db, TORONTO_ISH_POLYGON, input)
    expect(first).toEqual({ status: 'imported', action: 'inserted' })

    const second = await importServiceArea(handle.db, TORONTO_ISH_POLYGON, {
      ...input,
      sourceVersion: 'v2',
    })
    expect(second).toEqual({ status: 'imported', action: 'updated' })

    const rows = await handle.db.execute<{ n: number; source_version: string }>(sql`
      SELECT count(*)::int AS n, min(source_version) AS source_version
      FROM service_areas WHERE code = 'test-area'
    `)
    expect(rows.rows[0]).toEqual({ n: 1, source_version: 'v2' })

    // The stored geometry actually contains a downtown point.
    const contains = await handle.db.execute<{ ok: boolean }>(sql`
      SELECT ST_Contains(geometry, ST_SetSRID(ST_MakePoint(-79.3832, 43.6532), 4326)) AS ok
      FROM service_areas WHERE code = 'test-area'
    `)
    expect(contains.rows[0].ok).toBe(true)
  })

  it('dry-run validates without writing', async () => {
    const result = await importServiceArea(
      handle.db,
      TORONTO_ISH_POLYGON,
      { ...input, code: 'test-dry' },
      { dryRun: true },
    )
    expect(result).toEqual({ status: 'valid', dryRun: true })
    const rows = await handle.db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM service_areas WHERE code = 'test-dry'`,
    )
    expect(rows.rows[0].n).toBe(0)
  })

  it('rejects a non-polygon boundary file and self-intersecting geometry', async () => {
    const notAPolygon = { type: 'FeatureCollection', features: [] }
    expect((await importServiceArea(handle.db, notAPolygon, input)).status).toBe('invalid')

    const bowtie = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 1],
          [1, 0],
          [0, 1],
          [0, 0],
        ],
      ],
    }
    expect((await importServiceArea(handle.db, bowtie, input)).status).toBe('invalid')
  })
})
