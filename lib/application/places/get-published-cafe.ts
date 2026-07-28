import {
  buildAttributeDetails,
  buildAttributes,
  type PublishedCafeDetail,
} from '@/lib/domain/place-view'
import type { Db } from '@/lib/db/client'
import { getDb } from '@/lib/db/connection'
import {
  selectCurrentAttributes,
  selectCurrentHours,
  selectPublishedCafeBySlug,
} from '@/lib/db/queries/published-cafes'

// Use case: one published café detail DTO by slug, or null when no published,
// active record matches. Attribute values + per-attribute provenance/confidence
// and current hours are read through the recorded observations/history.
export async function getPublishedCafeBySlug(
  slug: string,
  db: Db = getDb(),
): Promise<PublishedCafeDetail | null> {
  const place = await selectPublishedCafeBySlug(db, slug)
  if (!place) return null

  const attributeRows = await selectCurrentAttributes(db, [place.id])
  const hours = await selectCurrentHours(db, place.id)

  return {
    id: place.id,
    slug: place.slug,
    name: place.name,
    neighborhood: place.neighborhood,
    latitude: place.latitude,
    longitude: place.longitude,
    address: place.address,
    website: place.website,
    phone: place.phone,
    attributes: buildAttributes(attributeRows.map((r) => ({ kind: r.kind, value: r.value }))),
    attributeDetails: buildAttributeDetails(attributeRows),
    hours,
  }
}
