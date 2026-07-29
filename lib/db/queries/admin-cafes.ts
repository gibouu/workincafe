import { eq } from 'drizzle-orm'
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
}

const adminCafeColumns = {
  id: places.id,
  slug: places.slug,
  name: places.name,
  neighborhood: places.neighborhood,
  publicationState: places.publicationState,
  recordState: places.recordState,
}

export async function selectAllCafes(db: Db): Promise<AdminCafeRow[]> {
  return db.select(adminCafeColumns).from(places).orderBy(places.name)
}

export async function selectCafeById(db: Db, id: string): Promise<AdminCafeRow | null> {
  const rows = await db.select(adminCafeColumns).from(places).where(eq(places.id, id)).limit(1)
  return rows[0] ?? null
}
