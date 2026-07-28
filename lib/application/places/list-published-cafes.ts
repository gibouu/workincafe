import type { AttributeKind, AttributeValue } from '@/lib/domain/attributes'
import { buildAttributes, type PublishedCafeSummary } from '@/lib/domain/place-view'
import type { Db } from '@/lib/db/client'
import { getDb } from '@/lib/db/connection'
import { selectCurrentAttributes, selectPublishedCafes } from '@/lib/db/queries/published-cafes'
import { selectPublishedCafeIdsWithinRadius, type RadiusQuery } from '@/lib/db/spatial/cafes'

// Use case: list published cafés as narrow public DTOs (Decision 16a — Server
// Components call this directly). Attributes come through the current-pointer →
// observation join; missing kinds default to `unknown`. An optional radius
// filter uses the reviewed spatial module and preserves nearest-first order.
export interface ListPublishedCafesOptions {
  near?: RadiusQuery
  limit?: number
}

export async function listPublishedCafes(
  opts: ListPublishedCafesOptions = {},
  db: Db = getDb(),
): Promise<PublishedCafeSummary[]> {
  let ids: string[] | undefined
  if (opts.near) {
    ids = await selectPublishedCafeIdsWithinRadius(db, opts.near)
    if (ids.length === 0) return []
  }

  const rows = await selectPublishedCafes(db, { ids, limit: opts.limit })
  const attributeRows = await selectCurrentAttributes(
    db,
    rows.map((r) => r.id),
  )

  const byPlace = new Map<string, { kind: AttributeKind; value: AttributeValue }[]>()
  for (const row of attributeRows) {
    const list = byPlace.get(row.placeId) ?? []
    list.push({ kind: row.kind, value: row.value })
    byPlace.set(row.placeId, list)
  }

  const summaries: PublishedCafeSummary[] = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    neighborhood: row.neighborhood,
    latitude: row.latitude,
    longitude: row.longitude,
    attributes: buildAttributes(byPlace.get(row.id) ?? []),
  }))

  if (ids) {
    const rank = new Map(ids.map((id, index) => [id, index]))
    summaries.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
  }
  return summaries
}
