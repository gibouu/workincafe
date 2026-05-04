/**
 * Foursquare Places API v3 client. Server-only — keep FOURSQUARE_API_KEY
 * out of any code that runs in the browser.
 *
 * Two operations we use:
 *   1. matchByLocation(name, lat, lng) — finds the most likely Foursquare
 *      record for one of our places. Uses the search endpoint with a
 *      tight radius and fuzzy name match.
 *   2. fetchDetails(fsq_id) — pulls hours, rating, popularity, price tier
 *      for an enrichment row.
 *
 * Foursquare ratings are 0–10 (well-suited to our 1–10 review scale).
 * Hours come back as `regular_hours.display`, a human string in OSM-ish
 * format ("Mon-Fri 8-18; Sat 9-17") plus a structured weekly array.
 */

const SEARCH_URL = 'https://api.foursquare.com/v3/places/search';
const DETAILS_URL = 'https://api.foursquare.com/v3/places';

export interface FoursquareMatch {
  fsq_id: string;
  name: string;
  distance_m: number;
}

export interface FoursquareDetails {
  fsq_id: string;
  name: string;
  rating?: number;          // 0..10
  price?: number;           // 1..4
  popularity?: number;      // 0..1
  hours_display?: string;   // e.g. "Mon-Fri 8:00 AM - 6:00 PM"
  hours_osm?: string;       // best-effort OSM-format string
  total_ratings?: number;
}

interface SearchResponse {
  results?: {
    fsq_id: string;
    name: string;
    distance: number;
  }[];
}

interface DetailsResponse {
  fsq_id: string;
  name: string;
  rating?: number;
  price?: number;
  popularity?: number;
  stats?: { total_ratings?: number };
  hours?: {
    display?: string;
    regular?: { day: number; open: string; close: string }[];
  };
}

function authHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: apiKey,
    accept: 'application/json',
  };
}

/**
 * Find the closest Foursquare place to (lat,lng) whose name fuzzy-matches.
 * `radiusM` defaults to 80 — tight enough that we don't grab neighbors.
 */
export async function matchByLocation(
  apiKey: string,
  name: string,
  lat: number,
  lng: number,
  opts: { radiusM?: number } = {},
): Promise<FoursquareMatch | null> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set('ll', `${lat},${lng}`);
  url.searchParams.set('radius', String(opts.radiusM ?? 80));
  url.searchParams.set('query', name);
  url.searchParams.set('limit', '5');
  const resp = await fetch(url.toString(), { headers: authHeaders(apiKey) });
  if (!resp.ok) return null;
  const data = (await resp.json()) as SearchResponse;
  const results = data.results ?? [];
  if (results.length === 0) return null;
  // Take the closest result whose name shares a token with ours; the API
  // already biased on `query` so this is a sanity check.
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const ourTokens = new Set(norm(name).split(/\s+/).filter((t) => t.length >= 3));
  const ranked = [...results].sort((a, b) => a.distance - b.distance);
  for (const r of ranked) {
    const theirTokens = norm(r.name).split(/\s+/);
    if (theirTokens.some((t) => ourTokens.has(t))) {
      return { fsq_id: r.fsq_id, name: r.name, distance_m: r.distance };
    }
  }
  return null;
}

export async function fetchDetails(apiKey: string, fsqId: string): Promise<FoursquareDetails | null> {
  const url = new URL(`${DETAILS_URL}/${encodeURIComponent(fsqId)}`);
  url.searchParams.set('fields', 'fsq_id,name,rating,price,popularity,stats,hours');
  const resp = await fetch(url.toString(), { headers: authHeaders(apiKey) });
  if (!resp.ok) return null;
  const data = (await resp.json()) as DetailsResponse;

  let osm: string | undefined;
  if (data.hours?.regular && data.hours.regular.length > 0) {
    osm = formatRegularToOsm(data.hours.regular);
  }
  return {
    fsq_id: data.fsq_id,
    name: data.name,
    rating: typeof data.rating === 'number' ? data.rating : undefined,
    price: typeof data.price === 'number' ? data.price : undefined,
    popularity: typeof data.popularity === 'number' ? data.popularity : undefined,
    total_ratings: data.stats?.total_ratings,
    hours_display: data.hours?.display,
    hours_osm: osm,
  };
}

/**
 * Convert Foursquare's `hours.regular` array into an OSM `opening_hours`
 * string. FSQ days are 1=Mon..7=Sun; OSM uses Mo/Tu/We/Th/Fr/Sa/Su.
 * Times are "HHMM" (e.g. "0830"). We collapse contiguous identical days.
 */
function formatRegularToOsm(regular: { day: number; open: string; close: string }[]): string {
  const OSM_DAYS = ['', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const fmt = (hhmm: string) => {
    const h = hhmm.slice(0, 2);
    const m = hhmm.slice(2, 4);
    return `${h}:${m}`;
  };
  // Group day → list of intervals.
  const byDay = new Map<number, string[]>();
  for (const r of regular) {
    if (!OSM_DAYS[r.day]) continue;
    const ranges = byDay.get(r.day) ?? [];
    ranges.push(`${fmt(r.open)}-${fmt(r.close)}`);
    byDay.set(r.day, ranges);
  }
  // Emit each day's rule. Don't try to collapse Mo-Fr style ranges — too
  // brittle when intervals differ. opening_hours.js parses per-day fine.
  const parts: string[] = [];
  for (let d = 1; d <= 7; d++) {
    const ranges = byDay.get(d);
    if (!ranges || ranges.length === 0) continue;
    parts.push(`${OSM_DAYS[d]} ${ranges.join(',')}`);
  }
  return parts.join('; ');
}
