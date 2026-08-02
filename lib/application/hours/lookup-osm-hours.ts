import { z } from 'zod'
import type { Db } from '@/lib/db/client'
import { getDb } from '@/lib/db/connection'
import { selectPlaceCoords } from '@/lib/db/queries/admin-cafes'
import type { WeeklyHoursV1 } from '@/lib/domain/hours'
import { parseOsmOpeningHours } from '@/lib/domain/osm-hours'
import { fetchNearbyOsmCafes } from '@/lib/integrations/osm/server/overpass'

// Use case: operator-triggered OSM hours lookup for one café (Decision 29).
// Queries Overpass around the café's canonical coordinates and returns
// session-only prefill candidates — the OSM element identity, its raw
// `opening_hours` value, the last-edit timestamp (staleness signal), and the
// conservative parse when the value is inside the supported subset. Nothing
// here writes; persistence happens only when the operator saves the hours
// form, which records the import provenance honestly.

const placeIdSchema = z.uuid()

// Overture-sourced coordinates and OSM positions drift a little; 100 m keeps
// same-block matches without pulling in the whole street.
const LOOKUP_RADIUS_METERS = 100
const MAX_CANDIDATES = 12

export interface OsmHoursCandidate {
  osmType: 'node' | 'way'
  osmId: string
  name: string | null
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

export async function lookupOsmHours(
  placeId: string,
  db: Db = getDb(),
): Promise<LookupOsmHoursResult> {
  if (!placeIdSchema.safeParse(placeId).success) return { status: 'not_found' }
  const coords = await selectPlaceCoords(db, placeId)
  if (!coords) return { status: 'not_found' }

  const result = await fetchNearbyOsmCafes(coords.latitude, coords.longitude, LOOKUP_RADIUS_METERS)
  if (result.status !== 'ok') return { status: 'failed' }

  const candidates = result.elements
    .map((e) => ({
      osmType: e.osmType,
      osmId: e.osmId,
      name: e.name,
      distanceMeters: Math.round(
        haversineMeters(coords.latitude, coords.longitude, e.latitude, e.longitude),
      ),
      openingHours: e.openingHours,
      lastEditedAt: e.lastEditedAt,
      schedule: e.openingHours ? parseOsmOpeningHours(e.openingHours) : null,
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, MAX_CANDIDATES)

  return { status: 'ok', candidates }
}
