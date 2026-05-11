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

// NB: a SEEDED_COUNTRIES allowlist was added in #134 to drop Dominica /
// Haiti hits when searching from Paris, but it also blocked users in any
// unseeded country (Brazil / India / etc.) from getting autocomplete
// results for their own area. Removed in #150 — bbox + tightened radius
// already handle the geographic relevance problem.

function parseBbox(raw: string | null): [number, number, number, number] | null {
  if (!raw) return null;
  const parts = raw.split(',').map((s) => Number.parseFloat(s.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [w, s, e, n] = parts;
  if (w < -180 || e > 180 || s < -90 || n > 90 || w > e || s > n) return null;
  return [w, s, e, n];
}

/** Coarse distance from a point to a bbox's center, used to derive a
 *  reasonable Foursquare `radius` when bbox is supplied. FSQ doesn't
 *  accept bbox directly — radius around the bias point is the closest
 *  equivalent. */
function bboxRadiusMeters(bbox: [number, number, number, number]): number {
  const [w, s, e, n] = bbox;
  const latSpan = n - s;
  const lngSpan = e - w;
  // Approx 111km per degree at mid-latitudes; half the diagonal in meters.
  const meters = 111_320 * Math.sqrt((latSpan / 2) ** 2 + (lngSpan / 2) ** 2);
  // Clamp: too tight misses neighborhood-scale searches; too loose pulls
  // in noise from neighboring metros.
  return Math.min(20_000, Math.max(2_000, Math.round(meters)));
}

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
  const googleKey = process.env.GOOGLE_PLACES_API_KEY;
  const fsqKey = process.env.FOURSQUARE_API_KEY;

  // Auth + rate-limit policy:
  // - If Google is configured (paid key), require auth so we don't act as a
  //   free public proxy. Rate-limit per user.
  // - If only Foursquare/Photon are configured (free), allow anonymous so
  //   the /places/new wizard works for signed-out browsers. Rate-limit by IP.
  const { user } = await getRequestActor(request);
  if (googleKey && !user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const rlKey =
    user?.id ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'anon';
  const rl = rateLimit('places-lookup', rlKey, { capacity: 60, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'too many requests' },
      { status: 429, headers: { 'retry-after': String(rl.retryAfterSec) } },
    );
  }

  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token') ?? '';
  const placeId = searchParams.get('placeId');

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
  const bbox = parseBbox(searchParams.get('bbox'));

  // Address-only mode: skip the POI-biased backends and hit Photon without
  // venue tag filters. Used by /places/new as a GPS fallback when the user
  // would rather type the address. PlaceId stays `osm:…`, so detail
  // lookups go through the existing photonPlaceDetails branch.
  if (searchParams.get('kind') === 'address') {
    return photonAddressAutocomplete(q, bias, bbox);
  }

  if (googleKey) return googleAutocomplete(googleKey, token, q);

  // Cascade Foursquare → Photon. Foursquare has stronger business coverage,
  // but for places not yet in their index (or ambiguous queries with no
  // bias) it returns 0 results. Falling through to Photon (OSM) gives a
  // second chance instead of showing an empty dropdown.
  if (fsqKey) {
    const fsq = await fetchFsqPredictions(fsqKey, q, bias, bbox);
    if (fsq.length > 0) return NextResponse.json({ predictions: fsq });
  }
  return photonAutocomplete(q, bbox);
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

// Children of a mall come back via the `related_places` field on the parent's
// Place Details payload. Each child is a slim Place object with an FSQ place
// id, name, location, and primary categories. We re-expose them as autocomplete
// predictions tagged with the parent mall so users searching for a tenant
// (e.g. "Starbucks Beaugrenelle") still find it — chains nested in malls don't
// surface as top-level FSQ search hits otherwise. See #34.
interface FsqRelatedChild {
  fsq_place_id: string;
  name?: string;
  location?: {
    formatted_address?: string;
    address?: string;
    locality?: string;
  };
  categories?: { name: string; short_name?: string }[];
}
interface FsqRelatedPlaces {
  related_places?: { children?: FsqRelatedChild[] };
}

// Lower-cased substrings that, when found in any of an FSQ result's category
// names, mark that result as a mall whose tenants we should expand inline.
// Foursquare's taxonomy uses several near-duplicate names for these — match
// loosely so we don't miss "Outlet Mall" or "Indoor Shopping Plaza".
const FSQ_MALL_KEYWORDS = ['shopping mall', 'mall', 'department store', 'shopping plaza'];

function isMallResult(r: FsqSearchResult): boolean {
  const cats = r.categories ?? [];
  for (const c of cats) {
    const n = (c.name ?? c.short_name ?? '').toLowerCase();
    if (!n) continue;
    if (FSQ_MALL_KEYWORDS.some((kw) => n.includes(kw))) return true;
  }
  return false;
}

// Cap to keep latency + response size bounded. Most malls have 50+ tenants;
// surfacing the top 8 keeps the dropdown navigable.
const MAX_MALLS_TO_EXPAND = 2;
const MAX_CHILDREN_PER_MALL = 8;

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

// Inner helper: fetches Foursquare predictions and returns the array
// directly (empty on upstream error). Lets the GET dispatcher cascade
// FSQ→Photon when FSQ has 0 hits without double-wrapping responses.
//
// When the top results include malls/department stores, we follow up with
// one Place Details call per mall (capped at MAX_MALLS_TO_EXPAND) to fetch
// `related_places.children` and inline tenants as additional predictions.
// Mall-internal chains (Starbucks Beaugrenelle, Apple Store at Westfield)
// don't show up as top-level FSQ search hits otherwise — see #34.
async function fetchFsqPredictions(
  apiKey: string,
  q: string,
  bias: { lat: number; lng: number } | null,
  bbox: [number, number, number, number] | null,
): Promise<AutocompletePrediction[]> {
  const url = new URL(FSQ_SEARCH_URL);
  url.searchParams.set('query', q);
  url.searchParams.set('limit', '8');
  if (bias) {
    url.searchParams.set('ll', `${bias.lat},${bias.lng}`);
    // When bbox is supplied, tighten the radius proportionally so FSQ
    // returns local hits instead of global brand matches. See #134.
    url.searchParams.set('radius', String(bbox ? bboxRadiusMeters(bbox) : 20_000));
  }
  const resp = await fetch(url.toString(), { headers: fsqHeaders(apiKey) });
  if (!resp.ok) return [];
  const data = (await resp.json()) as { results?: FsqSearchResult[] };
  const results = data.results ?? [];

  const base: AutocompletePrediction[] = results.map((r) => {
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

  // Identify mall hits in the top of the result list and expand their
  // children. Run in parallel so we don't compound latency.
  const malls = results.filter(isMallResult).slice(0, MAX_MALLS_TO_EXPAND);
  if (malls.length === 0) return base;

  const childGroups = await Promise.all(
    malls.map((m) => fetchFsqMallChildren(apiKey, m)),
  );
  const childPredictions = childGroups.flat();
  if (childPredictions.length === 0) return base;

  // Place children right after their parent mall in the list. That groups
  // tenants visually with the venue they belong to.
  const out: AutocompletePrediction[] = [];
  const childrenByMallId = new Map<string, AutocompletePrediction[]>();
  for (let i = 0; i < malls.length; i++) {
    childrenByMallId.set(`fsq:${malls[i].fsq_place_id}`, childGroups[i]);
  }
  for (const pred of base) {
    out.push(pred);
    const kids = childrenByMallId.get(pred.placeId);
    if (kids && kids.length > 0) out.push(...kids);
  }
  return out;
}

async function fetchFsqMallChildren(
  apiKey: string,
  mall: FsqSearchResult,
): Promise<AutocompletePrediction[]> {
  const url = new URL(`${FSQ_DETAILS_BASE}/${encodeURIComponent(mall.fsq_place_id)}`);
  url.searchParams.set('fields', 'related_places');
  const resp = await fetch(url.toString(), { headers: fsqHeaders(apiKey) });
  if (!resp.ok) return [];
  const data = (await resp.json()) as FsqRelatedPlaces;
  const children = data.related_places?.children ?? [];
  return children.slice(0, MAX_CHILDREN_PER_MALL).flatMap((c) => {
    if (!c.fsq_place_id || !c.name) return [];
    const sec = `Inside ${mall.name}`;
    return [
      {
        placeId: `fsq:${c.fsq_place_id}`,
        text: `${c.name} — ${sec}`,
        primary: c.name,
        secondary: sec,
      } satisfies AutocompletePrediction,
    ];
  });
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

async function photonAutocomplete(
  q: string,
  bbox: [number, number, number, number] | null,
): Promise<NextResponse> {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', q);
  url.searchParams.set('limit', '8');
  url.searchParams.set('lang', 'en');
  if (bbox) url.searchParams.set('bbox', bbox.join(','));
  for (const tag of PHOTON_TAGS) url.searchParams.append('osm_tag', tag);
  const resp = await fetch(url.toString());
  if (!resp.ok) {
    return NextResponse.json({ error: 'photon failed', status: resp.status }, { status: 502 });
  }
  const data = (await resp.json()) as { features?: PhotonFeature[] };
  const predictions: AutocompletePrediction[] = (data.features ?? []).map(featureToPrediction);
  return NextResponse.json({ predictions });
}

// Address-mode autocomplete: same Photon endpoint, no `osm_tag` filter so
// streets / house numbers / districts are eligible too. Used as a GPS
// fallback in /places/new — the user types an address, picks a suggestion,
// and the resulting lat/lng locks in for submission. Optional (lat,lng)
// bias nudges Photon to rank nearby results higher.
async function photonAddressAutocomplete(
  q: string,
  bias: { lat: number; lng: number } | null,
  bbox: [number, number, number, number] | null,
): Promise<NextResponse> {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', q);
  url.searchParams.set('limit', '8');
  url.searchParams.set('lang', 'en');
  if (bias) {
    url.searchParams.set('lat', String(bias.lat));
    url.searchParams.set('lon', String(bias.lng));
  }
  if (bbox) url.searchParams.set('bbox', bbox.join(','));
  const resp = await fetch(url.toString());
  if (!resp.ok) {
    return NextResponse.json({ error: 'photon failed', status: resp.status }, { status: 502 });
  }
  const data = (await resp.json()) as { features?: PhotonFeature[] };
  const predictions: AutocompletePrediction[] = (data.features ?? []).map(featureToPrediction);
  return NextResponse.json({ predictions });
}

// PlaceId scheme for Photon predictions:
//
//   osm:b64:<base64url-of-{lat,lng,name,addr,tags}>
//
// We embed the prediction's payload directly in the placeId so the detail
// endpoint can rehydrate without a second Photon call. Photon's public API
// has no "by id" lookup — the previous approach (free-text re-query of
// the bare osm_id) failed for nameless rows since their text isn't in the
// search index. See #31.
//
// We still fall back to the legacy `osm:<type>/<id>` format on detail if a
// stale prediction shows up (cached client, in-flight session, etc.) —
// best-effort, may still 404.

interface PhotonInline {
  lat: number;
  lng: number;
  name: string;
  addr: string;
  tags: string[];
}

function encodePhotonPlaceId(p: PhotonInline): string {
  const json = JSON.stringify(p);
  // Buffer.from is available in the Node runtime that powers this route.
  const b64 = Buffer.from(json, 'utf8').toString('base64url');
  return `osm:b64:${b64}`;
}

function decodePhotonPlaceId(placeId: string): PhotonInline | null {
  if (!placeId.startsWith('osm:b64:')) return null;
  try {
    const b64 = placeId.slice('osm:b64:'.length);
    const json = Buffer.from(b64, 'base64url').toString('utf8');
    const data = JSON.parse(json) as PhotonInline;
    if (typeof data.lat !== 'number' || typeof data.lng !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

async function photonPlaceDetails(placeId: string): Promise<NextResponse> {
  // New inline-encoded format — no upstream call, just decode and respond.
  const inline = decodePhotonPlaceId(placeId);
  if (inline) {
    const out: PlaceDetails = {
      placeId,
      name: inline.name ?? '',
      address: inline.addr ?? '',
      lat: inline.lat,
      lng: inline.lng,
      types: inline.tags ?? [],
    };
    return NextResponse.json(out);
  }

  // Legacy format `osm:<type>/<id>` — best-effort re-query; may 404 for
  // nameless rows. Still useful for any stale prediction surfaces.
  const m = placeId.match(/^osm:([NWR])\/(\d+)$/);
  if (!m) return NextResponse.json({ error: 'invalid placeId' }, { status: 400 });
  const [, osmType, osmId] = m;
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', osmId);
  url.searchParams.set('limit', '40');
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
  // For POI hits, `name` is set ("Café de la Paix"). For pure-address hits
  // (street/housenumber lookups), `name` is often empty — fall back to
  // "<housenumber> <street>" so the user sees something meaningful.
  const houseStreet = [f.properties.housenumber, f.properties.street]
    .filter(Boolean)
    .join(' ')
    .trim();
  const primary = f.properties.name ?? houseStreet ?? '';
  const sec = [
    f.properties.name ? houseStreet : null,
    f.properties.postcode,
    f.properties.city,
    f.properties.country,
  ]
    .filter(Boolean)
    .join(', ');
  const [lng, lat] = f.geometry.coordinates;
  const tags: string[] = [];
  if (f.properties.osm_key && f.properties.osm_value) {
    tags.push(`${f.properties.osm_key}:${f.properties.osm_value}`);
    tags.push(f.properties.osm_value);
  }
  const addressParts = [f.properties.housenumber, f.properties.street, f.properties.city].filter(
    Boolean,
  );
  const placeId = encodePhotonPlaceId({
    lat,
    lng,
    name: f.properties.name ?? '',
    addr: addressParts.join(' ').trim(),
    tags,
  });
  return {
    placeId,
    text: [primary, sec].filter(Boolean).join(' — '),
    primary,
    secondary: sec,
  };
}
