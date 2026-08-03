import { eq, sql } from 'drizzle-orm'
import type { PublicationState, RecordState } from '@/lib/domain/places'
import type { Db } from '../client'
import { places } from '../schema/places'

// Operator view: all café records regardless of state (Decision 8 — operators
// see drafts/hidden/closed/duplicates, not just published ones).
export interface AdminCafeRow {
  id: string
  slug: string
  name: string
  neighborhood: string | null
  publicationState: PublicationState
  recordState: RecordState
  website: string | null
  /** Publication gate (source/15): hours row present with all 7 days known. */
  hoursComplete: boolean
}

const hoursCompleteSql = sql<boolean>`EXISTS (
  SELECT 1 FROM place_hours h
  WHERE h.place_id = ${places.id}
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_each(h.schedule -> 'days') d
      WHERE d.value ->> 'state' = 'unknown'
    )
)`

const adminCafeColumns = {
  id: places.id,
  slug: places.slug,
  name: places.name,
  neighborhood: places.neighborhood,
  publicationState: places.publicationState,
  recordState: places.recordState,
  website: places.website,
  hoursComplete: hoursCompleteSql,
}

export async function selectAllCafes(db: Db): Promise<AdminCafeRow[]> {
  return db.select(adminCafeColumns).from(places).orderBy(places.name)
}

export async function selectCafeById(db: Db, id: string): Promise<AdminCafeRow | null> {
  const rows = await db.select(adminCafeColumns).from(places).where(eq(places.id, id)).limit(1)
  return rows[0] ?? null
}

/** Identity + coordinates + recorded website of an active café — the inputs
 * the hours-source lookups need (Decisions 29/30). */
export async function selectPlaceLookupInfo(
  db: Db,
  id: string,
): Promise<{ latitude: number; longitude: number; name: string; website: string | null } | null> {
  const rows = await db
    .select({
      latitude: places.latitude,
      longitude: places.longitude,
      name: places.name,
      website: places.website,
    })
    .from(places)
    .where(sql`${places.id} = ${id} AND ${places.recordState} = 'active'`)
    .limit(1)
  return rows[0] ?? null
}

/** Next active café still blocked from publishing by incomplete hours
 * (Decision 28 gate), excluding the current one, plus how many remain. */
export async function selectNextCafeNeedingHours(
  db: Db,
  excludeId: string | null,
): Promise<{ next: { id: string; name: string } | null; count: number }> {
  const rows = await db
    .select({ id: places.id, name: places.name })
    .from(places)
    .where(sql`${places.recordState} = 'active' AND NOT ${hoursCompleteSql}`)
    .orderBy(places.name)
  const remaining = rows.filter((r) => r.id !== excludeId)
  return { next: remaining[0] ?? null, count: remaining.length }
}
