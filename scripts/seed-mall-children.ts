/**
 * Operator-side seed of Foursquare mall tenants (#38).
 *
 * Strategy:
 *   1. For each target city (paris / toronto by default), Foursquare search
 *      for "shopping mall" inside the city bbox.
 *   2. For each mall hit, upsert the mall itself as a `category='other'`
 *      place so `parent_place_id` (#115) can FK to it.
 *   3. Fetch `related_places.children` for each mall and upsert children
 *      that map to work-relevant categories (cafe / bakery / restaurant
 *      / fast_food). Skip clothing stores, banks, anchors etc.
 *   4. Tag every row via `place_source_refs` (source='foursquare',
 *      external_id=fsq_place_id) so re-runs dedup.
 *
 * Idempotent: re-running upserts existing rows via normalized_name_hash
 * + source-refs unique constraint. Children are linked to their parent
 * via parent_place_id so the place card's "Inside [Mall Name]" hint
 * (shipped in #115) renders automatically.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/seed-mall-children.ts paris
 *   npx tsx --env-file=.env.local scripts/seed-mall-children.ts toronto
 *
 * Prereqs:
 *   FOURSQUARE_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   in .env.local. Migration 023 (parent_place_id) applied to the DB.
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { SEED_CITIES, getSeedCity, type SeedCity } from './seed-cities';

const FSQ_SEARCH_URL = 'https://places-api.foursquare.com/places/search';
const FSQ_DETAILS_BASE = 'https://places-api.foursquare.com/places';
const FSQ_API_VERSION = '2025-06-17';

const MALL_KEYWORDS = ['shopping mall', 'mall', 'department store', 'shopping plaza'];

// FSQ category-name substring → our place_category. Conservative: only
// surface tenants that actually fit the "work in cafe" use case. Anything
// not matched is skipped (no point inserting an Apple Store).
const FSQ_CATEGORY_HINTS: Array<[RegExp, 'cafe' | 'bakery' | 'restaurant' | 'fast_food_burger']> = [
  [/coffee|caf[ée]|espresso/i, 'cafe'],
  [/bakery|patisserie|p[âa]tisserie|boulangerie/i, 'bakery'],
  [/restaurant|brasserie|bistro|trattoria|diner|gastropub/i, 'restaurant'],
  [/fast food|burger|fried chicken|pizza place|food court/i, 'fast_food_burger'],
];

interface FsqCategory {
  name?: string;
  short_name?: string;
  plural_name?: string;
}

interface FsqSearchResult {
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
  categories?: FsqCategory[];
}

interface FsqRelatedChild {
  fsq_place_id: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  location?: {
    formatted_address?: string;
    address?: string;
    locality?: string;
    country?: string;
  };
  categories?: FsqCategory[];
}

interface FsqRelatedPlaces {
  related_places?: { children?: FsqRelatedChild[] };
}

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

const hashKey = (name: string, lat: number, lng: number) =>
  crypto
    .createHash('sha1')
    .update(`${normalize(name)}|${lat.toFixed(4)}|${lng.toFixed(4)}`)
    .digest('hex')
    .slice(0, 16);

function isMall(r: FsqSearchResult): boolean {
  for (const c of r.categories ?? []) {
    const n = (c.name ?? c.short_name ?? c.plural_name ?? '').toLowerCase();
    if (MALL_KEYWORDS.some((kw) => n.includes(kw))) return true;
  }
  return false;
}

/** Map FSQ category names to our internal place_category. Returns null
 *  when none of the work-relevant hints match — caller skips that child. */
function categoryFor(child: FsqRelatedChild): string | null {
  for (const c of child.categories ?? []) {
    const name = c.name ?? c.short_name ?? c.plural_name ?? '';
    for (const [pattern, cat] of FSQ_CATEGORY_HINTS) {
      if (pattern.test(name)) return cat;
    }
  }
  return null;
}

function fsqHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    'X-Places-Api-Version': FSQ_API_VERSION,
    accept: 'application/json',
  };
}

async function searchMalls(
  apiKey: string,
  city: SeedCity,
): Promise<FsqSearchResult[]> {
  // FSQ ll=lat,lng + radius is the closest equivalent to bbox.
  const [s, w, n, e] = city.bbox;
  const lat = (s + n) / 2;
  const lng = (w + e) / 2;
  // Half the diagonal in meters, clamped to FSQ's 100km cap.
  const radius = Math.min(
    100_000,
    Math.round(111_320 * Math.sqrt(((n - s) / 2) ** 2 + ((e - w) / 2) ** 2)),
  );
  const all: FsqSearchResult[] = [];
  // Two passes with slightly different queries to widen coverage.
  for (const query of ['shopping mall', 'department store']) {
    const url = new URL(FSQ_SEARCH_URL);
    url.searchParams.set('query', query);
    url.searchParams.set('ll', `${lat},${lng}`);
    url.searchParams.set('radius', String(radius));
    url.searchParams.set('limit', '50');
    const resp = await fetch(url.toString(), { headers: fsqHeaders(apiKey) });
    if (!resp.ok) {
      console.error(`[mall-seed] FSQ search for "${query}" failed: ${resp.status}`);
      continue;
    }
    const data = (await resp.json()) as { results?: FsqSearchResult[] };
    for (const r of data.results ?? []) {
      if (isMall(r) && r.latitude !== undefined && r.longitude !== undefined) {
        all.push(r);
      }
    }
  }
  // Dedup by fsq_place_id since the two queries overlap.
  const seen = new Set<string>();
  return all.filter((r) => {
    if (seen.has(r.fsq_place_id)) return false;
    seen.add(r.fsq_place_id);
    return true;
  });
}

async function fetchChildren(
  apiKey: string,
  fsqPlaceId: string,
): Promise<FsqRelatedChild[]> {
  const url = new URL(`${FSQ_DETAILS_BASE}/${encodeURIComponent(fsqPlaceId)}`);
  url.searchParams.set('fields', 'related_places');
  const resp = await fetch(url.toString(), { headers: fsqHeaders(apiKey) });
  if (!resp.ok) return [];
  const data = (await resp.json()) as FsqRelatedPlaces;
  return data.related_places?.children ?? [];
}

async function seedCity(citySlug: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const fsqKey = process.env.FOURSQUARE_API_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE env (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).');
  }
  if (!fsqKey) {
    throw new Error('Missing FOURSQUARE_API_KEY in .env.local.');
  }
  const city = getSeedCity(citySlug);
  if (!city) {
    throw new Error(`Unknown city "${citySlug}". Available: ${SEED_CITIES.map((c) => c.key).join(', ')}`);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  console.log(`[mall-seed] ${city.key}: searching FSQ for malls in bbox...`);
  const malls = await searchMalls(fsqKey, city);
  console.log(`[mall-seed] ${city.key}: found ${malls.length} mall candidates`);

  let mallsUpserted = 0;
  let childrenUpserted = 0;
  let childrenSkipped = 0;

  for (const mall of malls) {
    if (mall.latitude === undefined || mall.longitude === undefined) continue;
    const mallHash = hashKey(mall.name, mall.latitude, mall.longitude);
    const mallCity = mall.location?.locality ?? city.label;
    const mallCountry = (mall.location?.country ?? city.country).toUpperCase();

    // Upsert mall as 'other' so children can FK to it.
    const { data: mallRow, error: mallErr } = await supabase
      .from('places')
      .upsert(
        {
          name: mall.name,
          address: mall.location?.formatted_address ?? mall.location?.address ?? null,
          city: mallCity,
          country: mallCountry,
          lat: mall.latitude,
          lng: mall.longitude,
          category: 'other',
          normalized_name_hash: mallHash,
        },
        { onConflict: 'normalized_name_hash' },
      )
      .select('id')
      .maybeSingle();
    if (mallErr || !mallRow) {
      console.error(`[mall-seed] ${city.key}: upsert mall "${mall.name}" failed:`, mallErr?.message);
      continue;
    }
    mallsUpserted++;

    // Source-ref so future re-runs can also dedup by FSQ id.
    const { error: mallRefErr } = await supabase
      .from('place_source_refs')
      .upsert(
        { source: 'foursquare', external_id: mall.fsq_place_id, normalized_name_hash: mallHash },
        { onConflict: 'source,external_id' },
      );
    if (mallRefErr) {
      console.error(`[mall-seed] ${city.key}: source-ref for mall "${mall.name}" failed:`, mallRefErr.message);
      continue;
    }

    const children = await fetchChildren(fsqKey, mall.fsq_place_id);
    if (children.length === 0) continue;

    const childRows: Array<{
      name: string;
      address: string | null;
      city: string;
      country: string;
      lat: number;
      lng: number;
      category: string;
      normalized_name_hash: string;
      parent_place_id: string;
    }> = [];
    const childRefs: Array<{
      source: 'foursquare';
      external_id: string;
      normalized_name_hash: string;
    }> = [];

    for (const child of children) {
      if (!child.name || child.latitude === undefined || child.longitude === undefined) {
        childrenSkipped++;
        continue;
      }
      const cat = categoryFor(child);
      if (!cat) {
        childrenSkipped++;
        continue;
      }
      const childHash = hashKey(child.name, child.latitude, child.longitude);
      childRows.push({
        name: child.name,
        address: child.location?.formatted_address ?? child.location?.address ?? null,
        city: child.location?.locality ?? mallCity,
        country: (child.location?.country ?? mallCountry).toUpperCase(),
        lat: child.latitude,
        lng: child.longitude,
        category: cat,
        normalized_name_hash: childHash,
        parent_place_id: mallRow.id,
      });
      childRefs.push({
        source: 'foursquare',
        external_id: child.fsq_place_id,
        normalized_name_hash: childHash,
      });
    }

    if (childRows.length === 0) continue;

    const { error: childErr } = await supabase
      .from('places')
      .upsert(childRows, { onConflict: 'normalized_name_hash' });
    if (childErr) {
      console.error(`[mall-seed] ${city.key}: upsert children of "${mall.name}" failed:`, childErr.message);
      continue;
    }
    const { error: childRefsErr } = await supabase
      .from('place_source_refs')
      .upsert(childRefs, { onConflict: 'source,external_id' });
    if (childRefsErr) {
      console.error(`[mall-seed] ${city.key}: source-refs for children of "${mall.name}" failed:`, childRefsErr.message);
      continue;
    }
    childrenUpserted += childRows.length;
    console.log(`[mall-seed] ${city.key}: "${mall.name}" → ${childRows.length} tenants`);
  }

  console.log(
    `[mall-seed] ${city.key}: done. malls=${mallsUpserted} children_inserted=${childrenUpserted} children_skipped=${childrenSkipped}`,
  );
}

async function main() {
  const arg = process.argv[2]?.toLowerCase();
  if (!arg) {
    console.error('Usage: tsx scripts/seed-mall-children.ts <paris|toronto|...>');
    process.exit(1);
  }
  await seedCity(arg);
}

main().catch((err) => {
  console.error('[mall-seed] fatal', err);
  process.exit(1);
});
