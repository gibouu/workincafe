import 'server-only'
import { z } from 'zod'

// Server-only Overpass API caller for the Decision 29 OSM hours lookup.
// Operator-triggered only — never scheduled, never on page load. Overpass is a
// free community service: no key, no billable accounting, a single attempt
// with no automatic retry, and an identifying User-Agent per the OSM operations
// policy. Live-fetch (`no-store`); results are session-only prefill assistance
// that an operator must confirm before anything persists.

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const USER_AGENT = 'WorkinCafe-curation/1.0 (https://github.com/gibouu/workincafe)'
const QUERY_TIMEOUT_S = 8

const elementSchema = z.looseObject({
  type: z.string(),
  id: z.number(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  center: z.looseObject({ lat: z.number(), lon: z.number() }).optional(),
  timestamp: z.string().optional(),
  tags: z
    .looseObject({
      name: z.string().optional(),
      opening_hours: z.string().optional(),
    })
    .optional(),
})

const responseSchema = z.looseObject({
  elements: z.array(elementSchema).default([]),
})

export interface OsmCafeElement {
  osmType: 'node' | 'way'
  osmId: string
  name: string | null
  openingHours: string | null
  latitude: number
  longitude: number
  lastEditedAt: string | null
}

export type OverpassResult =
  { status: 'ok'; elements: OsmCafeElement[] } | { status: 'failed'; httpStatus: number | null }

type FetchLike = (url: string, init: RequestInit) => Promise<Response>

function buildQuery(latitude: number, longitude: number, radiusMeters: number): string {
  const around = `(around:${radiusMeters},${latitude},${longitude})`
  return (
    `[out:json][timeout:${QUERY_TIMEOUT_S}];(` +
    `node["amenity"="cafe"]${around};` +
    `way["amenity"="cafe"]${around};` +
    `node["shop"="coffee"]${around};` +
    `way["shop"="coffee"]${around};` +
    `);out center meta;`
  )
}

/** Live-fetch OSM café/coffee elements near a coordinate. */
export async function fetchNearbyOsmCafes(
  latitude: number,
  longitude: number,
  radiusMeters: number,
  fetchImpl: FetchLike = fetch,
): Promise<OverpassResult> {
  let response: Response
  try {
    response = await fetchImpl(OVERPASS_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: `data=${encodeURIComponent(buildQuery(latitude, longitude, radiusMeters))}`,
    })
  } catch {
    return { status: 'failed', httpStatus: null }
  }

  if (!response.ok) return { status: 'failed', httpStatus: response.status }

  let parsed: z.infer<typeof responseSchema>
  try {
    parsed = responseSchema.parse(await response.json())
  } catch {
    return { status: 'failed', httpStatus: response.status }
  }

  const elements = parsed.elements.flatMap((e): OsmCafeElement[] => {
    if (e.type !== 'node' && e.type !== 'way') return []
    const latitude = e.lat ?? e.center?.lat
    const longitude = e.lon ?? e.center?.lon
    if (latitude === undefined || longitude === undefined) return []
    return [
      {
        osmType: e.type,
        osmId: String(e.id),
        name: e.tags?.name?.trim() || null,
        openingHours: e.tags?.opening_hours?.trim() || null,
        latitude,
        longitude,
        lastEditedAt: e.timestamp ?? null,
      },
    ]
  })

  return { status: 'ok', elements }
}
