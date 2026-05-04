/**
 * Foursquare Places API client (post-2025 endpoints).
 *
 *   Base: https://places-api.foursquare.com
 *   Auth: Authorization: Bearer <FOURSQUARE_API_KEY>
 *   Required: X-Places-Api-Version: 2025-06-17
 *
 * The 2025 API put rating, price, popularity, and hours behind a Premium
 * (paid) tier. The free tier still returns the place's address, phone,
 * website, social media handles, and chain affiliation — useful for
 * filling in our `places` table when OSM is sparse.
 *
 * For ratings + hours we use Yelp instead (`lib/places/yelp.ts`).
 */

const SEARCH_URL = 'https://places-api.foursquare.com/places/search';
const API_VERSION = '2025-06-17';

export interface FoursquareEnrichment {
  name: string;
  formatted_address?: string;
  tel?: string;
  website?: string;
  /** Foursquare chain id, e.g. for Starbucks. Useful for brand mapping. */
  chain_name?: string;
  twitter?: string;
  facebook_id?: string;
  primary_category?: string;
}

interface SearchResponse {
  results?: FoursquareResult[];
}

interface FoursquareResult {
  name: string;
  location?: {
    address?: string;
    locality?: string;
    region?: string;
    postcode?: string;
    country?: string;
    formatted_address?: string;
  };
  tel?: string;
  website?: string;
  social_media?: {
    facebook_id?: string;
    twitter?: string;
  };
  chains?: { fsq_chain_id: string; name: string }[];
  categories?: { name: string; short_name?: string }[];
}

function authHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    'X-Places-Api-Version': API_VERSION,
    accept: 'application/json',
  };
}

/**
 * Find the closest Foursquare place to (lat,lng) whose name fuzzy-matches.
 * Returns the enrichment fields we'd backfill into our `places` row.
 *
 * `radiusM` defaults to 200 — the new API's geocoder is less precise than
 * the v3 era and tends to return empty at radii under 100m even for
 * obvious matches.
 */
export async function matchEnrichment(
  apiKey: string,
  name: string,
  lat: number,
  lng: number,
  opts: { radiusM?: number } = {},
): Promise<FoursquareEnrichment | null> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set('ll', `${lat},${lng}`);
  url.searchParams.set('radius', String(opts.radiusM ?? 200));
  url.searchParams.set('query', name);
  url.searchParams.set('limit', '5');
  const resp = await fetch(url.toString(), { headers: authHeaders(apiKey) });
  if (!resp.ok) return null;
  const data = (await resp.json()) as SearchResponse;
  const results = data.results ?? [];
  if (results.length === 0) return null;

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const ourTokens = new Set(norm(name).split(/\s+/).filter((t) => t.length >= 3));

  // Prefer the first result whose name shares a meaningful token with ours.
  // The API already biased on `query`, so this is the sanity check.
  for (const r of results) {
    const theirTokens = norm(r.name).split(/\s+/);
    if (theirTokens.some((t) => ourTokens.has(t))) {
      return shape(r);
    }
  }
  // Fallback: first result. Better to over-match than miss.
  return shape(results[0]);
}

function shape(r: FoursquareResult): FoursquareEnrichment {
  return {
    name: r.name,
    formatted_address: r.location?.formatted_address,
    tel: r.tel,
    website: r.website,
    chain_name: r.chains?.[0]?.name,
    twitter: r.social_media?.twitter,
    facebook_id: r.social_media?.facebook_id,
    primary_category: r.categories?.[0]?.short_name ?? r.categories?.[0]?.name,
  };
}
