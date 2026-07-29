import { sql } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from '@/lib/db/client'

// Operator-run service-area boundary import (Step 3B amendment D; slice 2).
// Loads the authoritative launch polygon (Toronto, from Toronto Open Data —
// city-owned data, persistable) into `service_areas`. Upsert by area code;
// geometry is validated by PostGIS before any write. Never scheduled; never in
// the request path.

const geometrySchema = z.object({
  type: z.enum(['Polygon', 'MultiPolygon']),
  coordinates: z.array(z.unknown()).min(1),
})

// Accepts a bare geometry, a Feature, or a FeatureCollection whose first
// feature carries the boundary (the shape Toronto Open Data exports).
const boundaryFileSchema = z.union([
  geometrySchema,
  z.object({ type: z.literal('Feature'), geometry: geometrySchema }),
  z.object({
    type: z.literal('FeatureCollection'),
    features: z.array(z.object({ type: z.literal('Feature'), geometry: geometrySchema })).min(1),
  }),
])

export interface ServiceAreaImportInput {
  code: string
  name: string
  source: string
  sourceVersion: string
}

export type ServiceAreaImportResult =
  | { status: 'imported'; action: 'inserted' | 'updated' }
  | { status: 'valid'; dryRun: true }
  | { status: 'invalid'; message: string }

export async function importServiceArea(
  db: Db,
  boundaryFileJson: unknown,
  input: ServiceAreaImportInput,
  opts: { dryRun?: boolean } = {},
): Promise<ServiceAreaImportResult> {
  const parsed = boundaryFileSchema.safeParse(boundaryFileJson)
  if (!parsed.success) {
    return { status: 'invalid', message: 'boundary file is not a valid GeoJSON (Multi)Polygon' }
  }
  const geometry =
    'geometry' in parsed.data
      ? parsed.data.geometry
      : 'features' in parsed.data
        ? parsed.data.features[0].geometry
        : parsed.data
  const geometryJson = JSON.stringify(geometry)

  // Validate with PostGIS before any write: parseable, valid, non-empty.
  const valid = await db.execute<{ ok: boolean }>(sql`
    SELECT ST_IsValid(ST_GeomFromGeoJSON(${geometryJson})) AND
           NOT ST_IsEmpty(ST_GeomFromGeoJSON(${geometryJson})) AS ok
  `)
  if (valid.rows[0]?.ok !== true) {
    return { status: 'invalid', message: 'geometry rejected by PostGIS validation' }
  }
  if (opts.dryRun === true) return { status: 'valid', dryRun: true }

  // Single-statement upsert: atomic without an explicit transaction.
  const res = await db.execute<{ inserted: boolean }>(sql`
    INSERT INTO service_areas (code, name, source, source_version, geometry, active)
    VALUES (
      ${input.code}, ${input.name}, ${input.source}, ${input.sourceVersion},
      ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${geometryJson}), 4326)), true
    )
    ON CONFLICT (code) DO UPDATE SET
      name = EXCLUDED.name,
      source = EXCLUDED.source,
      source_version = EXCLUDED.source_version,
      geometry = EXCLUDED.geometry,
      active = true,
      imported_at = now()
    RETURNING (xmax = 0) AS inserted
  `)
  const action = res.rows[0]?.inserted === true ? ('inserted' as const) : ('updated' as const)
  return { status: 'imported', action }
}
