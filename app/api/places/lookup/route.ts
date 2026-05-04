import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';

/**
 * Server proxy for place autocomplete + details. Two modes:
 *
 *   GET /api/places/lookup?q=<query>&token=<sessionToken>
 *     → Autocomplete. Returns trimmed predictions.
 *
 *   GET /api/places/lookup?placeId=<id>&token=<sessionToken>
 *     → Place details. Returns the trimmed payload AddPlaceSheet uses.
 *
 * Backend selection:
 *   - If GOOGLE_PLACES_API_KEY is set → Google Places API (New). Best
 *     business-data coverage but billed.
 *   - Otherwise → Photon (Komoot, OSM-based, no key, free). Same response
 *     shape so the client doesn't care which backend served it. The
 *     placeId for Photon is `osm:<type>/<id>` so we can refetch details
 *     from the Photon get-by-id endpoint.
 *
 * Gated to authenticated users so the Google key (when present) is not a
 * free public proxy.
 */

const PLACES_AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const PLACES_DETAILS_BASE = 'https://places.googleapis.com/v1/places';

interface AutocompletePrediction {
  placeId: string;
  text: string;
  primary: string;
  secondary: string;
}

interface PlaceDetails {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  types: string[];
}

export async function GET(request: NextRequest) {
  const { user } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token') ?? '';
  const placeId = searchParams.get('placeId');
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (placeId) {
    return apiKey
      ? googlePlaceDetails(apiKey, token, placeId)
      : photonPlaceDetails(placeId);
  }

  const q = searchParams.get('q')?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ predictions: [] satisfies AutocompletePrediction[] });
  }
  return apiKey ? googleAutocomplete(apiKey, token, q) : photonAutocomplete(q);
}

async function googleAutocomplete(apiKey: string, token: string, q: string): Promise<NextResponse> {
  const body: Record<string, unknown> = {
    input: q,
    includedPrimaryTypes: ['cafe', 'restaurant', 'bakery', 'library', 'lodging'],
    languageCode: 'en',
  };
  if (token) body.sessionToken = token;

  const resp = await fetch(PLACES_AUTOCOMPLETE_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    return NextResponse.json(
      { error: 'autocomplete failed', status: resp.status, detail: text.slice(0, 300) },
      { status: 502 },
    );
  }
  const data = (await resp.json()) as {
    suggestions?: {
      placePrediction?: {
        placeId: string;
        text?: { text?: string };
        structuredFormat?: {
          mainText?: { text?: string };
          secondaryText?: { text?: string };
        };
      };
    }[];
  };
  const predictions: AutocompletePrediction[] = (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => ({
      placeId: p.placeId,
      text: p.text?.text ?? '',
      primary: p.structuredFormat?.mainText?.text ?? '',
      secondary: p.structuredFormat?.secondaryText?.text ?? '',
    }));
  return NextResponse.json({ predictions });
}

async function googlePlaceDetails(apiKey: string, token: string, placeId: string): Promise<NextResponse> {
  const url = new URL(`${PLACES_DETAILS_BASE}/${encodeURIComponent(placeId)}`);
  if (token) url.searchParams.set('sessionToken', token);
  const resp = await fetch(url.toString(), {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,types',
    },
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    return NextResponse.json(
      { error: 'details failed', status: resp.status, detail: text.slice(0, 300) },
      { status: 502 },
    );
  }
  const data = (await resp.json()) as {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    types?: string[];
  };
  if (!data.location || typeof data.location.latitude !== 'number' || typeof data.location.longitude !== 'number') {
    return NextResponse.json({ error: 'no location' }, { status: 502 });
  }
  const out: PlaceDetails = {
    placeId: data.id ?? placeId,
    name: data.displayName?.text ?? '',
    address: data.formattedAddress ?? '',
    lat: data.location.latitude,
    lng: data.location.longitude,
    types: data.types ?? [],
  };
  return NextResponse.json(out);
}

// ── Photon (free, OSM-based) ────────────────────────────────────────────
// https://photon.komoot.io — no key required. We bias toward our two cities
// to keep results relevant; passing a category filter (osm_tag) narrows
// hits to the venue types we care about.

interface PhotonFeature {
  type: 'Feature';
  geometry: { coordinates: [number, number]; type: 'Point' };
  properties: {
    osm_id: number;
    osm_type: string;
    osm_key?: string;
    osm_value?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    country?: string;
    countrycode?: string;
    postcode?: string;
    type?: string;
  };
}

const PHOTON_TAGS = [
  'amenity:cafe',
  'amenity:restaurant',
  'amenity:fast_food',
  'amenity:library',
  'amenity:coworking_space',
  'amenity:ice_cream',
  'shop:bakery',
  'shop:coffee',
  'tourism:hotel',
];

async function photonAutocomplete(q: string): Promise<NextResponse> {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', q);
  url.searchParams.set('limit', '8');
  url.searchParams.set('lang', 'en');
  for (const tag of PHOTON_TAGS) url.searchParams.append('osm_tag', tag);
  const resp = await fetch(url.toString());
  if (!resp.ok) {
    return NextResponse.json({ error: 'photon failed', status: resp.status }, { status: 502 });
  }
  const data = (await resp.json()) as { features?: PhotonFeature[] };
  const predictions: AutocompletePrediction[] = (data.features ?? []).map(featureToPrediction);
  return NextResponse.json({ predictions });
}

async function photonPlaceDetails(placeId: string): Promise<NextResponse> {
  // placeId format from Photon predictions: "osm:<osm_type>/<osm_id>"
  const m = placeId.match(/^osm:([NWR])\/(\d+)$/);
  if (!m) return NextResponse.json({ error: 'invalid placeId' }, { status: 400 });
  const [, osmType, osmId] = m;
  // Photon's public API doesn't expose a "by id" endpoint; do a free-text
  // re-query with high limit and filter to the matching osm_id.
  // (For typical add-place usage the autocomplete result already carried
  // everything we need, so we re-encode it here from the cached prediction.)
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', osmId);
  url.searchParams.set('limit', '40');
  for (const tag of PHOTON_TAGS) url.searchParams.append('osm_tag', tag);
  const resp = await fetch(url.toString());
  if (!resp.ok) return NextResponse.json({ error: 'photon failed', status: resp.status }, { status: 502 });
  const data = (await resp.json()) as { features?: PhotonFeature[] };
  const match = (data.features ?? []).find(
    (f) => String(f.properties.osm_id) === osmId && f.properties.osm_type?.[0] === osmType,
  );
  if (!match) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const [lng, lat] = match.geometry.coordinates;
  const addressParts = [match.properties.housenumber, match.properties.street, match.properties.city].filter(Boolean);
  const types: string[] = [];
  if (match.properties.osm_key && match.properties.osm_value) {
    types.push(`${match.properties.osm_key}:${match.properties.osm_value}`);
    types.push(match.properties.osm_value);
  }
  const out: PlaceDetails = {
    placeId,
    name: match.properties.name ?? '',
    address: addressParts.join(' ').trim(),
    lat,
    lng,
    types,
  };
  return NextResponse.json(out);
}

function featureToPrediction(f: PhotonFeature): AutocompletePrediction {
  const t = f.properties.osm_type?.[0] ?? 'N';
  const placeId = `osm:${t}/${f.properties.osm_id}`;
  const primary = f.properties.name ?? '';
  const sec = [f.properties.street, f.properties.city, f.properties.country].filter(Boolean).join(', ');
  return {
    placeId,
    text: [primary, sec].filter(Boolean).join(' — '),
    primary,
    secondary: sec,
  };
}
