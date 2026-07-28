import { and, eq, inArray, sql } from 'drizzle-orm'
import type { AttributeKind, AttributeValue } from '@/lib/domain/attributes'
import type { WeeklyHoursV1 } from '@/lib/domain/hours'
import type { ConfidenceLevel, ProvenanceKind } from '@/lib/domain/provenance'
import type { Db } from '../client'
import { places } from '../schema/places'

// Typed public read queries (Decision 6 exemplar). Only published + active places
// are ever returned. Attribute values are read *through* the current-pointer →
// observation join so a summary can never disagree with its recorded history.

export interface PlaceRow {
  id: string
  slug: string
  name: string
  address: string | null
  neighborhood: string | null
  website: string | null
  phone: string | null
  latitude: number
  longitude: number
}

const placeColumns = {
  id: places.id,
  slug: places.slug,
  name: places.name,
  address: places.address,
  neighborhood: places.neighborhood,
  website: places.website,
  phone: places.phone,
  latitude: places.latitude,
  longitude: places.longitude,
}

export async function selectPublishedCafes(
  db: Db,
  opts: { ids?: string[]; limit?: number } = {},
): Promise<PlaceRow[]> {
  if (opts.ids && opts.ids.length === 0) return []
  const conditions = [eq(places.publicationState, 'published'), eq(places.recordState, 'active')]
  if (opts.ids) conditions.push(inArray(places.id, opts.ids))
  return db
    .select(placeColumns)
    .from(places)
    .where(and(...conditions))
    .orderBy(places.name)
    .limit(opts.limit ?? 200)
}

export async function selectPublishedCafeBySlug(db: Db, slug: string): Promise<PlaceRow | null> {
  const rows = await db
    .select(placeColumns)
    .from(places)
    .where(
      and(
        eq(places.slug, slug),
        eq(places.publicationState, 'published'),
        eq(places.recordState, 'active'),
      ),
    )
    .limit(1)
  return rows[0] ?? null
}

export interface CurrentAttributeRow {
  placeId: string
  kind: AttributeKind
  value: AttributeValue
  provenance: ProvenanceKind
  confidence: ConfidenceLevel
  observedAt: string
}

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value)
}

export async function selectCurrentAttributes(
  db: Db,
  placeIds: string[],
): Promise<CurrentAttributeRow[]> {
  if (placeIds.length === 0) return []
  const idList = sql.join(
    placeIds.map((id) => sql`${id}`),
    sql`, `,
  )
  const res = await db.execute<{
    place_id: string
    kind: AttributeKind
    value: AttributeValue
    provenance_kind: ProvenanceKind
    confidence: ConfidenceLevel
    observed_at: unknown
  }>(sql`
    SELECT c.place_id, c.kind, o.value, o.provenance_kind, o.confidence, o.observed_at
    FROM place_attribute_current c
    JOIN attribute_observations o ON o.id = c.current_observation_id
    WHERE c.place_id IN (${idList})
  `)
  return res.rows.map((r) => ({
    placeId: r.place_id,
    kind: r.kind,
    value: r.value,
    provenance: r.provenance_kind,
    confidence: r.confidence,
    observedAt: toIso(r.observed_at),
  }))
}

export async function selectCurrentHours(db: Db, placeId: string): Promise<WeeklyHoursV1 | null> {
  const res = await db.execute<{ schedule: WeeklyHoursV1 }>(
    sql`SELECT schedule FROM place_hours WHERE place_id = ${placeId}`,
  )
  return res.rows[0]?.schedule ?? null
}
