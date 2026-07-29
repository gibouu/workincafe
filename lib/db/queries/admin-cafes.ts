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

export async function selectAllCafes(db: Db): Promise<AdminCafeRow[]> {
  return db
    .select({
      id: places.id,
      slug: places.slug,
      name: places.name,
      neighborhood: places.neighborhood,
      publicationState: places.publicationState,
      recordState: places.recordState,
    })
    .from(places)
    .orderBy(places.name)
}
