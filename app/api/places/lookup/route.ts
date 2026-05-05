import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Server proxy for place autocomplete + details. Two modes:
 *
 *   GET /api/places/lookup?q=<query>&token=<sessionToken>&lat=<lat>&lng=<lng>
 *     → Autocomplete. Returns trimmed predictions. lat/lng are optional
 *       location-bias hints used by the Foursquare backend.
 *
 *   GET /api/places/lookup?placeId=<id>&token=<sessionToken>
 *     → Place details. Returns the trimmed payload the wizard uses.
 *
 * Backend selection (autocomplete):
 *   1. GOOGLE_PLACES_API_KEY → Google Places API (New). Best business-data
 *      coverage but billed.
 *   2. FOURSQUARE_API_KEY → Foursquare Places API (post-2025). Free tier,
 *      strong global POI coverage including small indie shops Photon misses.
 *   3. Photon (Komoot, OSM-based, no key, free) — last resort.
 *
 * Detail backend is picked by the placeId prefix the prediction carried:
 *   - `osm:<type>/<id>` → Photon
 *   - `fsq:<fsq_place_id>` → Foursquare
 *   - anything else → Google (when key present)
 *
 * Gated to authenticated users so paid keys are not free public proxies.
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

  // 60/min per user. Photon (the upstream when Google is unset) caps us
  // at ~1 req/sec by IP — our server is one IP from their POV, so we
  // keep total throughput modest.
  const rl = rateLimit('places-lookup', user.id, { capacity: 60, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'too many requests' },
      { status: 429, headers: { 'retry-after': String(rl.retryAfterSec) } },
    );
  }

  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token') ?? '';
  const placeId = searchParams.get('placeId');
  const googleKey = process.env.GOOGLE_PLACES_API_KEY;
  const fsqKey = process.env.FOURSQUARE_API_KEY;

  if (placeId) {
    if (placeId.startsWith('osm:')) return photonPlaceDetails(placeId);
    if (placeId.startsWith('fsq:')) {
      if (!fsqKey) return NextResponse.json({ error: 'foursquare unavailable' }, { status: 503 });
      return foursquarePlaceDetails(fsqKey, placeId);
    }
    if (googleKey) return googlePlaceDetails(googleKey, token, placeId);
    return NextResponse.json({ error: 'unknown placeId backend' }, { status: 400 });
  }

  const q = searchParams.get('q')?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ predictions: [] satisfies AutocompletePrediction[] });
  }
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? '');
  const bias =
    Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;

  if (googleKey) return googleAutocomplete(googleKey, token, q);
  if (fsqKey) return foursquareAutocomplete(fsqKey, q, bias);
  return photonAutocomplete(q);
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

// ── Foursquare Places API (post-2025) ───────────────────────────────────
// https://docs.foursquare.com/developer/reference/place-search
// Bearer auth + X-Places-Api-Version header. Free tier covers search,
// place details, address, phone, website, social handles, primary
// category. Rating/hours are paid-tier — not used here.
//
// We accept an optional (lat,lng) bias from the wizard so results rank
// by proximity. Without bias we still get global ranking by relevance,
// which is fine but less helpful for "the café across the street".

const FSQ_SEARCH_URL = 'https://places-api.foursquare.com/places/search';
const FSQ_DETAILS_BASE = 'https://places-api.foursquare.com/places';
const FSQ_API_VERSION = '2025-06-17';

interface FsqSearchResult {
  fsq_place_id: string;
  name: string;
  location?: {
    address?: string;
    locality?: string;
    region?: string;
    country?: string;
    formatted_address?: string;
  };
  latitude?: number;
  longitude?: number;
  categories?: { name: string; short_name?: string; plural_name?: string }[];
}

interface FsqDetailsResult {
  fsq_place_id: string;
  name: string;
  latitude?: number;
  longitude?: number;
  location?: {
    formatted_address?: string;
    address?: string;
    locality?: string;
    country?: string;
  };
  categories?: { name: string; short_name?: string }[];
}

function fsqHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    'X-Places-Api-Version': FSQ_API_VERSION,
    accept: 'application/json',
  };
}

async function foursquareAutocomplete(
  apiKey: string,
  q: string,
  bias: { lat: number; lng: number } | null,
): Promise<NextResponse> {
  const url = new URL(FSQ_SEARCH_URL);
  url.searchParams.set('query', q);
  url.searchParams.set('limit', '8');
  if (bias) {
    url.searchParams.set('ll', `${bias.lat},${bias.lng}`);
    url.searchParams.set('radius', '20000');
  }
  const resp = await fetch(url.toString(), { headers: fsqHeaders(apiKey) });
  if (!resp.ok) {
    return NextResponse.json(
      { error: 'foursquare failed', status: resp.status },
      { status: 502 },
    );
  }
  const data = (await resp.json()) as { results?: FsqSearchResult[] };
  const predictions: AutocompletePrediction[] = (data.results ?? []).map((r) => {
    const sec =
      r.location?.formatted_address ||
      [r.location?.address, r.location?.locality, r.location?.country]
        .filter(Boolean)
        .join(', ');
    return {
      placeId: `fsq:${r.fsq_place_id}`,
      text: [r.name, sec].filter(Boolean).join(' — '),
      primary: r.name,
      secondary: sec,
    };
  });
  return NextResponse.json({ predictions });
}

async function foursquarePlaceDetails(
  apiKey: string,
  placeId: string,
): Promise<NextResponse> {
  const fsqId = placeId.slice('fsq:'.length);
  if (!fsqId) return NextResponse.json({ error: 'invalid placeId' }, { status: 400 });
  const url = new URL(`${FSQ_DETAILS_BASE}/${encodeURIComponent(fsqId)}`);
  url.searchParams.set(
    'fields',
    'fsq_place_id,name,latitude,longitude,location,categories',
  );
  const resp = await fetch(url.toString(), { headers: fsqHeaders(apiKey) });
  if (!resp.ok) {
    return NextResponse.json(
      { error: 'foursquare details failed', status: resp.status },
      { status: 502 },
    );
  }
  const data = (await resp.json()) as FsqDetailsResult;
  if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
    return NextResponse.json({ error: 'no location' }, { status: 502 });
  }
  const types = (data.categories ?? [])
    .flatMap((c) => [c.short_name, c.name])
    .filter((t): t is string => Boolean(t))
    .map((t) => t.toLowerCase());
  const out: PlaceDetails = {
    placeId,
    name: data.name ?? '',
    address: data.location?.formatted_address ?? '',
    lat: data.latitude,
    lng: data.longitude,
    types,
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
