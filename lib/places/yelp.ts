/**
 * Yelp Fusion API client (v3).
 *
 *   Base: https://api.yelp.com/v3
 *   Auth: Authorization: Bearer <YELP_API_KEY>
 *   Free tier: 5,000 calls/day, 300 calls/sec.
 *
 * Used to seed an initial rating + price tier on each place so the app
 * isn't a "phonebook with no signal." Yelp ratings are 1–5 in 0.5 steps
 * which we scale to our 1–10 review scale (round half-up).
 */

const SEARCH_URL = 'https://api.yelp.com/v3/businesses/search';
const DETAILS_URL_BASE = 'https://api.yelp.com/v3/businesses';

export interface YelpMatch {
  id: string;
  name: string;
  distance_m: number;
  rating: number;          // 1..5 (0.5 steps)
  review_count: number;
  price?: string;          // "$" .. "$$$$"
  categories?: string[];
}

export interface YelpDetails extends YelpMatch {
  phone?: string;
  display_address?: string[];
  hours_osm?: string;      // best-effort OSM-format opening_hours
  is_closed_permanently?: boolean;
}

interface YelpSearchResponse {
  businesses?: YelpBusiness[];
}

interface YelpBusiness {
  id: string;
  name: string;
  rating?: number;
  review_count?: number;
  price?: string;
  distance?: number;
  categories?: { alias: string; title: string }[];
  is_closed?: boolean;
}

interface YelpDetailsResponse {
  id: string;
  name: string;
  rating?: number;
  review_count?: number;
  price?: string;
  phone?: string;
  is_closed?: boolean;
  categories?: { alias: string; title: string }[];
  hours?: {
    hours_type: string;
    open: { day: number; start: string; end: string; is_overnight: boolean }[];
    is_open_now?: boolean;
  }[];
  location?: { display_address?: string[] };
}

function authHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    accept: 'application/json',
  };
}

/**
 * Find the Yelp business closest to (lat,lng) whose name fuzzy-matches.
 * Defaults to a 200m radius. Returns the search-tier shape (name, rating,
 * review_count, price). For hours we have to follow up with `fetchDetails`.
 */
export async function searchByLocation(
  apiKey: string,
  name: string,
  lat: number,
  lng: number,
  opts: { radiusM?: number } = {},
): Promise<YelpMatch | null> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lng));
  url.searchParams.set('radius', String(Math.min(40000, opts.radiusM ?? 200)));
  url.searchParams.set('term', name);
  url.searchParams.set('limit', '5');
  url.searchParams.set('sort_by', 'distance');
  const resp = await fetch(url.toString(), { headers: authHeaders(apiKey) });
  if (!resp.ok) return null;
  const data = (await resp.json()) as YelpSearchResponse;
  const businesses = (data.businesses ?? []).filter((b) => !b.is_closed);
  if (businesses.length === 0) return null;

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const ourTokens = new Set(norm(name).split(/\s+/).filter((t) => t.length >= 3));

  const candidates = [...businesses].sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9));
  for (const b of candidates) {
    const theirTokens = norm(b.name).split(/\s+/);
    if (theirTokens.some((t) => ourTokens.has(t))) {
      return shape(b);
    }
  }
  // Fallback: closest by distance.
  return shape(candidates[0]);
}

function shape(b: YelpBusiness): YelpMatch {
  return {
    id: b.id,
    name: b.name,
    distance_m: Math.round(b.distance ?? 0),
    rating: b.rating ?? 0,
    review_count: b.review_count ?? 0,
    price: b.price,
    categories: (b.categories ?? []).map((c) => c.title),
  };
}

export async function fetchDetails(apiKey: string, businessId: string): Promise<YelpDetails | null> {
  const url = `${DETAILS_URL_BASE}/${encodeURIComponent(businessId)}`;
  const resp = await fetch(url, { headers: authHeaders(apiKey) });
  if (!resp.ok) return null;
  const data = (await resp.json()) as YelpDetailsResponse;

  let osm: string | undefined;
  const regular = data.hours?.find((h) => h.hours_type === 'REGULAR');
  if (regular) osm = formatYelpHoursToOsm(regular.open);

  return {
    id: data.id,
    name: data.name,
    distance_m: 0,
    rating: data.rating ?? 0,
    review_count: data.review_count ?? 0,
    price: data.price,
    phone: data.phone,
    display_address: data.location?.display_address,
    categories: (data.categories ?? []).map((c) => c.title),
    hours_osm: osm,
    is_closed_permanently: data.is_closed,
  };
}

/**
 * Yelp `hours.open` uses day=0..6 (Mon..Sun) and times like "0830"–"1700".
 * Convert to OSM `Mo 08:30-17:00; Tu …` per-day rules. is_overnight rolls
 * past midnight; we clamp to the current day for simplicity.
 */
function formatYelpHoursToOsm(open: { day: number; start: string; end: string }[]): string {
  const OSM_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']; // Yelp 0..6 = Mon..Sun
  const fmt = (hhmm: string) => `${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}`;
  const byDay = new Map<number, string[]>();
  for (const o of open) {
    if (o.day < 0 || o.day > 6) continue;
    const ranges = byDay.get(o.day) ?? [];
    ranges.push(`${fmt(o.start)}-${fmt(o.end)}`);
    byDay.set(o.day, ranges);
  }
  const parts: string[] = [];
  for (let d = 0; d < 7; d++) {
    const ranges = byDay.get(d);
    if (!ranges || ranges.length === 0) continue;
    parts.push(`${OSM_DAYS[d]} ${ranges.join(',')}`);
  }
  return parts.join('; ');
}

/**
 * Yelp price tier ($, $$, $$$, $$$$) → coarse currency-amount estimate
 * for places.avg_spend_eur. Toronto $ ≈ $5–10 CAD ≈ €4. Crude but better
 * than zero.
 */
export function priceToAvgSpendEur(price: string | undefined): number {
  if (!price) return 0;
  switch (price.length) {
    case 1: return 6;   // $
    case 2: return 14;  // $$
    case 3: return 32;  // $$$
    case 4: return 60;  // $$$$
    default: return 0;
  }
}
