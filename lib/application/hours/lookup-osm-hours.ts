import { z } from 'zod'
import type { Db } from '@/lib/db/client'
import { getDb } from '@/lib/db/connection'
import { selectPlaceLookupInfo } from '@/lib/db/queries/admin-cafes'
import type { WeeklyHoursV1 } from '@/lib/domain/hours'
import { type NameMatch, osmNamePattern, scoreNameMatch } from '@/lib/domain/name-match'
import { parseOsmOpeningHours } from '@/lib/domain/osm-hours'
import { fetchNearbyOsmCafes } from '@/lib/integrations/osm/server/overpass'

// Use case: operator-triggered OSM hours lookup for one café (Decisions
// 29/30). Two search angles in one Overpass query — cafés near the canonical
// coordinates, plus same-named venues in a wider ring (coordinate drift) —
// then every candidate is name-scored against OUR canonical name so the
// operator sees "likely this café" separated from "merely nearby". Session-
// only prefill; nothing persists until the operator saves the hours form.

const placeIdSchema = z.uuid()

// Overture-sourced coordinates and OSM positions drift a little; 100 m keeps
// same-block matches without pulling in the whole street.
const LOOKUP_RADIUS_METERS = 100
const MAX_CANDIDATES = 12

export interface OsmHoursCandidate {
  osmType: 'node' | 'way'
  osmId: string
  name: string | null
  /** Scored against the café's canonical name — labeling only, never auto-applied. */
  nameMatch: NameMatch
  distanceMeters: number
  openingHours: string | null
  lastEditedAt: string | null
  schedule: WeeklyHoursV1 | null
}

export type LookupOsmHoursResult =
  { status: 'ok'; candidates: OsmHoursCandidate[] } | { status: 'not_found' } | { status: 'failed' }

function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 6371000 * 2 * Math.asin(Math.sqrt(s))
}

const MATCH_RANK: Record<NameMatch, number> = { match: 0, close: 1, other: 2 }

export async function lookupOsmHours(
  placeId: string,
  db: Db = getDb(),
): Promise<LookupOsmHoursResult> {
  if (!placeIdSchema.safeParse(placeId).success) return { status: 'not_found' }
  const info = await selectPlaceLookupInfo(db, placeId)
  if (!info) return { status: 'not_found' }

  const result = await fetchNearbyOsmCafes(
    info.latitude,
    info.longitude,
    LOOKUP_RADIUS_METERS,
    osmNamePattern(info.name),
  )
  if (result.status !== 'ok') return { status: 'failed' }

  const candidates = result.elements
    .map((e) => ({
      osmType: e.osmType,
      osmId: e.osmId,
      name: e.name,
      nameMatch: scoreNameMatch(info.name, e.name),
      distanceMeters: Math.round(
        haversineMeters(info.latitude, info.longitude, e.latitude, e.longitude),
      ),
      openingHours: e.openingHours,
      lastEditedAt: e.lastEditedAt,
      schedule: e.openingHours ? parseOsmOpeningHours(e.openingHours) : null,
    }))
    .sort(
      (a, b) =>
        MATCH_RANK[a.nameMatch] - MATCH_RANK[b.nameMatch] ||
        Number(b.openingHours !== null) - Number(a.openingHours !== null) ||
        a.distanceMeters - b.distanceMeters,
    )
    .slice(0, MAX_CANDIDATES)

  return { status: 'ok', candidates }
}
