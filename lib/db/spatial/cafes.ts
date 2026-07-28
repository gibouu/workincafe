import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { latitudeSchema, longitudeSchema } from '@/lib/domain/places'
import type { Db } from '../client'

// Reviewed spatial-query module (Decision 6): parameterized SQL templates, typed
// and validated inputs, typed outputs, no arbitrary SQL fragments. Operates on
// the database-generated `places.geog` geography via its GiST index. No raw
// spatial SQL lives in routes or components.

const radiusMetersSchema = z.number().positive().max(50_000)

export interface RadiusQuery {
  longitude: number
  latitude: number
  radiusMeters: number
}

/** Published + active café ids within `radiusMeters` of a point, nearest first. */
export async function selectPublishedCafeIdsWithinRadius(
  db: Db,
  query: RadiusQuery,
): Promise<string[]> {
  const longitude = longitudeSchema.parse(query.longitude)
  const latitude = latitudeSchema.parse(query.latitude)
  const radiusMeters = radiusMetersSchema.parse(query.radiusMeters)
  const point = sql`ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography`
  const res = await db.execute<{ id: string }>(sql`
    SELECT p.id
    FROM places p
    WHERE p.publication_state = 'published'
      AND p.record_state = 'active'
      AND ST_DWithin(p.geog, ${point}, ${radiusMeters})
    ORDER BY ST_Distance(p.geog, ${point})
  `)
  return res.rows.map((r) => r.id)
}
