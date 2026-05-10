/**
 * Work in Cafe — OSM Overpass bulk seed (spec §11.2)
 *
 * Usage:
 *   npx tsx scripts/seed-osm.ts paris            # one city by key
 *   npx tsx scripts/seed-osm.ts --all-new        # all cafe-only cities
 *   npx tsx scripts/seed-osm.ts --all            # every configured city
 *
 * Prereqs:
 *   - SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local
 *   - places / place_source_refs tables exist (run supabase/migrations/001_init.sql first)
 *
 * Cities + bboxes live in scripts/seed-cities.ts.
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { isWorkConducive } from '../lib/places/work-conducive';
import { looksLikeApartmentBuilding } from '../lib/places/looks-like-apartment';
import { bucketForFastFoodBrand } from '../lib/places/fast-food-buckets';
import {
  SEED_CITIES,
  buildOverpassQuery,
  getSeedCity,
  type SeedCity,
} from './seed-cities';

// Map (amenity | shop | tourism) tag values → our place_category enum.
// OSM tagging is split: cafés are amenity=cafe but bakeries are shop=bakery,
// specialty coffee roasters use shop=coffee, hotels are tourism=hotel.
const AMENITY_MAP: Record<string, string> = {
  cafe: 'cafe',
  library: 'library',
  coworking_space: 'coworking',
  fast_food: 'fast_food',
  restaurant: 'restaurant',
  ice_cream: 'cafe',
  internet_cafe: 'cafe',
};
const SHOP_MAP: Record<string, string> = {
  bakery: 'bakery',
  pastry: 'bakery',
  coffee: 'cafe',
  tea: 'cafe',
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
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

const hashKey = (name: string, lat: number, lng: number) =>
  crypto
    .createHash('sha1')
    .update(`${normalize(name)}|${lat.toFixed(4)}|${lng.toFixed(4)}`)
    .digest('hex')
    .slice(0, 16);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function seedCity(city: SeedCity) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE env. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.',
    );
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const endpoint = process.env.OVERPASS_ENDPOINT ?? 'https://overpass-api.de/api/interpreter';
  const query = buildOverpassQuery(city);

  console.log(`[osm] Querying Overpass for ${city.key} (${city.mode}) — bbox ${city.bbox.join(',')} (~60-180s)…`);
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
      const shop = tags.shop;
      const tourism = tags.tourism;
      // Resolve in priority order: amenity → shop → tourism → 'other'.
      // tourism=hotel|hostel|guest_house|motel all collapse to our 'hotel'
      // category since the use case is identical (lobby work spot).
      let category =
        (amenity && AMENITY_MAP[amenity]) ||
        (shop && SHOP_MAP[shop]) ||
        (tourism && /^(hotel|hostel|guest_house|motel)$/.test(tourism) ? 'hotel' : 'other');
      // Split `amenity=fast_food` by brand: fast-casual chains (Chipotle,
      // Pret, Cojean, Exki…) become `restaurant`; everything else becomes
      // `fast_food_burger`. See #80 + lib/places/fast-food-buckets.ts.
      if (category === 'fast_food') {
        category = bucketForFastFoodBrand(tags.brand);
      }
      const address = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
      return {
        name: tags.name,
        address: address || null,
        city: city.label,
        country: city.country,
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

  // Dedup + quality filter (spec §11.2): keep anything with at least one
  // piece of meaningful tagging beyond name + lat/lng. Original gate required
  // website/phone/brand which dropped most cafés (OSM contact data is sparse);
  // widened to also accept hours, address, cuisine, or internet_access — all
  // proxies for "someone bothered to tag this place with substance."
  const deduped = [...new Map(places.map((p) => [p.normalized_name_hash, p])).values()].filter(
    (p) =>
      p.website ||
      p.phone ||
      p.brand ||
      p.hours_json ||
      p.address ||
      (p.osm_tags as { cuisine?: unknown; internet_access?: unknown } | null)?.cuisine ||
      (p.osm_tags as { cuisine?: unknown; internet_access?: unknown } | null)?.internet_access,
  );

  // Work-conducive hours filter — drop dinner-only / split-shift restaurants
  // and fast-food. Cafes / bakeries / libraries / coworking / hotel pass
  // through unchanged. See lib/places/work-conducive.ts.
  let droppedByHours = 0;
  let droppedByApartment = 0;
  const droppedByCategory: Record<string, number> = {};
  const unique = deduped.filter((p) => {
    if (p.category === 'hotel' && looksLikeApartmentBuilding(p.name)) {
      droppedByApartment++;
      return false;
    }
    const raw = (p.hours_json as { raw?: string } | null)?.raw ?? null;
    const ok = isWorkConducive(p.category, raw);
    if (!ok) {
      droppedByHours++;
      droppedByCategory[p.category] = (droppedByCategory[p.category] ?? 0) + 1;
    }
    return ok;
  });

  console.log(
    `[osm] ${city.key}: ${json.elements.length} raw → ${deduped.length} after dedup/quality → ${unique.length} after hours+apartment filter`,
  );
  if (droppedByApartment > 0) {
    console.log(`[osm] ${city.key}: apartment filter dropped ${droppedByApartment} hotel-tagged résidences/student housing`);
  }
  if (droppedByHours > 0) {
    console.log(
      `[osm] ${city.key}: hours filter dropped ${droppedByHours} (${Object.entries(droppedByCategory)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')})`,
    );
  }

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

    console.log(`[osm] ${city.key}: upserted ${Math.min(i + 500, unique.length)}/${unique.length}`);
  }

  console.log(`[osm] ${city.key}: done (${unique.length} places)`);
  return unique.length;
}

function resolveCities(arg: string | undefined): SeedCity[] {
  if (!arg) return [];
  if (arg === '--all') return SEED_CITIES;
  if (arg === '--all-new') return SEED_CITIES.filter((c) => c.mode === 'cafe-only');
  const city = getSeedCity(arg.toLowerCase());
  return city ? [city] : [];
}

async function main() {
  const arg = process.argv[2];
  const cities = resolveCities(arg);
  if (cities.length === 0) {
    console.error(
      `Usage: tsx scripts/seed-osm.ts <key|--all|--all-new>\n  keys: ${SEED_CITIES.map((c) => c.key).join(', ')}`,
    );
    process.exit(1);
  }

  let totalInserted = 0;
  for (let i = 0; i < cities.length; i++) {
    const city = cities[i];
    try {
      const n = await seedCity(city);
      totalInserted += n;
    } catch (err) {
      // Don't abort the whole batch on a single Overpass timeout — the public
      // mirror occasionally rejects big queries. Log + continue. Re-running
      // the same key later is idempotent.
      console.error(`[osm] ${city.key} failed:`, err);
    }
    // Be polite to the public Overpass mirror between cities.
    if (i < cities.length - 1) await sleep(5000);
  }
  if (cities.length > 1) {
    console.log(`[osm] batch done: ${totalInserted} total places across ${cities.length} cities`);
  }
}

main().catch((err) => {
  console.error('[osm] fatal', err);
  process.exit(1);
});
