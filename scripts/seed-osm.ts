/**
 * Work in Cafe — OSM Overpass bulk seed (spec §11.2)
 *
 * Usage:
 *   pnpm seed:paris          # via package.json script
 *   tsx scripts/seed-osm.ts paris
 *   tsx scripts/seed-osm.ts toronto
 *
 * Prereqs:
 *   - SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local
 *   - places / place_source_refs tables exist (run supabase/migrations/001_init.sql first)
 */

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';

type OsmCity = 'paris' | 'toronto';

const SUPPORTED: OsmCity[] = ['paris', 'toronto'];

const CATEGORY_MAP: Record<string, string> = {
  cafe: 'cafe',
  bakery: 'bakery',
  library: 'library',
  coworking_space: 'coworking',
  fast_food: 'fast_food',
  restaurant: 'restaurant',
};

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

const hashKey = (name: string, lat: number, lng: number) =>
  crypto
    .createHash('sha1')
    .update(`${normalize(name)}|${lat.toFixed(4)}|${lng.toFixed(4)}`)
    .digest('hex')
    .slice(0, 16);

async function seedCity(city: OsmCity) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE env. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.',
    );
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const endpoint = process.env.OVERPASS_ENDPOINT ?? 'https://overpass-api.de/api/interpreter';
  const queryPath = path.join(process.cwd(), 'scripts', `seed-overpass-${city}.ql`);
  const query = await readFile(queryPath, 'utf8');

  console.log(`[osm] Querying Overpass for ${city} (~60-120s)…`);
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      // Overpass mirrors reject requests without a UA / Accept header.
      'user-agent': 'workincafe-seed/0.1 (https://workin.cafe; ops@workin.cafe)',
      accept: 'application/json',
    },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!resp.ok) throw new Error(`Overpass ${resp.status}: ${await resp.text().catch(() => '')}`);
  const json = (await resp.json()) as OverpassResponse;

  const countryCode = city === 'paris' ? 'FR' : 'CA';
  const cityDisplay = city === 'paris' ? 'Paris' : 'Toronto';

  type PlaceInsert = {
    name: string;
    address: string | null;
    city: string;
    country: string;
    lat: number;
    lng: number;
    category: string;
    brand: string | null;
    phone: string | null;
    website: string | null;
    hours_json: { raw: string } | null;
    normalized_name_hash: string;
    osm_tags: Record<string, unknown>;
  };

  const places = json.elements
    .map((el): PlaceInsert | null => {
      const tags = el.tags ?? {};
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      if (!tags.name || lat === undefined || lng === undefined) return null;
      const amenity = tags.amenity;
      const tourism = tags.tourism;
      // CATEGORY_MAP[amenity] can be undefined for amenities outside our taxonomy
      // (e.g. amenity=bar). Fall back to tourism=hotel mapping, then 'other'.
      const category =
        (amenity && CATEGORY_MAP[amenity]) ||
        (tourism === 'hotel' ? 'hotel' : 'other');
      const address = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
      return {
        name: tags.name,
        address: address || null,
        city: cityDisplay,
        country: countryCode,
        lat,
        lng,
        category,
        brand: tags.brand ?? null,
        phone: tags.phone ?? tags['contact:phone'] ?? null,
        website: tags.website ?? tags['contact:website'] ?? null,
        hours_json: tags.opening_hours ? { raw: tags.opening_hours } : null,
        normalized_name_hash: hashKey(tags.name, lat, lng),
        osm_tags: {
          internet_access: tags.internet_access,
          outdoor_seating: tags.outdoor_seating,
          wheelchair: tags.wheelchair,
          cuisine: tags.cuisine,
          osm_type: el.type,
          osm_id: el.id,
        },
      };
    })
    .filter((p): p is PlaceInsert => p !== null);

  // Dedup + quality filter (spec §11.2: require website OR phone OR brand).
  const unique = [...new Map(places.map((p) => [p.normalized_name_hash, p])).values()].filter(
    (p) => p.website || p.phone || p.brand,
  );

  console.log(`[osm] ${city}: ${json.elements.length} raw → ${unique.length} after dedup/quality`);

  for (let i = 0; i < unique.length; i += 500) {
    const batch = unique.slice(i, i + 500);
    const { error: placesError } = await supabase
      .from('places')
      .upsert(batch, { onConflict: 'normalized_name_hash' });
    if (placesError) throw placesError;

    const refs = batch.map((p) => ({
      source: 'osm',
      external_id: `${p.osm_tags.osm_type}/${p.osm_tags.osm_id}`,
      normalized_name_hash: p.normalized_name_hash,
    }));
    const { error: refsError } = await supabase
      .from('place_source_refs')
      .upsert(refs, { onConflict: 'source,external_id' });
    if (refsError) throw refsError;

    console.log(`[osm] ${city}: upserted ${Math.min(i + 500, unique.length)}/${unique.length}`);
  }

  console.log(`[osm] ${city}: done (${unique.length} places)`);
}

async function main() {
  const arg = process.argv[2]?.toLowerCase() as OsmCity | undefined;
  if (!arg || !SUPPORTED.includes(arg)) {
    console.error(`Usage: tsx scripts/seed-osm.ts <${SUPPORTED.join('|')}>`);
    process.exit(1);
  }
  await seedCity(arg);
}

main().catch((err) => {
  console.error('[osm] fatal', err);
  process.exit(1);
});
