/**
 * Work in Cafe — enrich places using the Yelp Fusion API.
 *
 * For each place (filtered by --city), this script:
 *   1. Searches Yelp by name + lat/lng to find the matching business.
 *   2. Fetches details to get hours.
 *   3. Backfills places.hours_json (when our row had no OSM hours),
 *      places.phone, places.website (from Yelp URL), places.address.
 *   4. Inserts a synthetic review with source='yelp', source_weight=0.5.
 *      Yelp ratings (1..5 in 0.5 steps) are scaled to our 1..10 scale
 *      using round-half-up.
 *
 * Idempotent: re-runs skip places that already have a yelp-source review.
 *
 * Daily quota: Yelp Fusion free tier is 5,000 calls/day. We make 2 calls
 * per place (search + details), so roughly 2,500 places/day. Toronto's
 * work-friendly subset (~2,000) fits in one run; Paris (~4,300) takes
 * two days.
 *
 * Usage:
 *   npm run enrich:yelp -- --city=toronto --dry-run --limit=20
 *   npm run enrich:yelp -- --city=toronto --limit=2400
 *   npm run enrich:yelp -- --city=paris
 */

import { createClient } from '@supabase/supabase-js';
import { searchByLocation, fetchDetails } from '../lib/places/yelp';

const SYS_USER_ID = '00000000-0000-0000-0000-0000000005ed';

const args = process.argv.slice(2);
const argMap = new Map<string, string>();
for (const a of args) {
  if (a.startsWith('--')) {
    const eq = a.indexOf('=');
    if (eq > 0) argMap.set(a.slice(2, eq), a.slice(eq + 1));
    else argMap.set(a.slice(2), 'true');
  }
}
const DRY_RUN = argMap.get('dry-run') === 'true';
const CITY_ARG = argMap.get('city')?.toLowerCase();
const CITY = CITY_ARG === 'paris' ? 'Paris' : CITY_ARG === 'toronto' ? 'Toronto' : null;
const LIMIT = Math.max(1, Math.min(50000, Number(argMap.get('limit') ?? 2400)));
const SLEEP_MS = Math.max(50, Number(argMap.get('sleep') ?? 200));

if (!CITY) fail('--city=paris|toronto is required');

const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const YELP_KEY = requireEnv('YELP_API_KEY');

interface PlaceRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
  hours_json: { raw?: string } | null;
  phone: string | null;
  address: string | null;
}

function yelpRatingToOurs(rating: number): number {
  // Yelp 0..5 (0.5 steps) → ours 1..10 (round half up). 4.5 → 9, 5.0 → 10.
  if (!rating || rating <= 0) return 0;
  return Math.max(1, Math.min(10, Math.round(rating * 2)));
}

async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Skip places that already have a yelp-source review.
  const { data: enrichedRows } = await sb
    .from('reviews')
    .select('place_id')
    .eq('source', 'yelp')
    .eq('user_id', SYS_USER_ID);
  const enriched = new Set<string>((enrichedRows ?? []).map((r) => (r as { place_id: string }).place_id));
  console.log(`[yelp] already enriched: ${enriched.size}`);

  // Pull places we'd want to enrich. Skip restaurants/fast_food (we don't
  // review those — they're stay-too-short for work).
  const PAGE = 1000;
  let from = 0;
  const candidates: PlaceRow[] = [];
  while (candidates.length < LIMIT) {
    const need = LIMIT - candidates.length;
    const take = Math.min(PAGE, need);
    const { data, error } = await sb
      .from('places')
      .select('id, name, lat, lng, hours_json, phone, address')
      .eq('city', CITY!)
      .in('category', ['cafe', 'bakery', 'library', 'coworking', 'hotel'])
      .order('id')
      .range(from, from + take - 1);
    if (error) fail(`select places: ${error.message}`);
    const rows = (data ?? []) as PlaceRow[];
    if (rows.length === 0) break;
    for (const r of rows) {
      if (!enriched.has(r.id)) candidates.push(r);
    }
    if (rows.length < take) break;
    from += rows.length;
  }
  console.log(`[yelp] candidates after dedup: ${candidates.length} (city=${CITY})`);

  let matched = 0;
  let skipped = 0;
  let errored = 0;
  let hoursBackfilled = 0;
  let phoneBackfilled = 0;
  let addressBackfilled = 0;
  let reviewsInserted = 0;

  for (let i = 0; i < candidates.length; i++) {
    const p = candidates[i];
    try {
      const m = await searchByLocation(YELP_KEY, p.name, p.lat, p.lng);
      if (!m) {
        skipped++;
      } else {
        const d = await fetchDetails(YELP_KEY, m.id);
        if (!d) {
          skipped++;
        } else {
          matched++;
          const ours10 = yelpRatingToOurs(d.rating);
          if (DRY_RUN) {
            console.log(
              `  · ${p.name} → ${m.name} (${m.distance_m}m, rating=${d.rating}/5 → ${ours10}/10, price=${d.price ?? '—'}, hours=${d.hours_osm ? 'yes' : 'no'})`,
            );
          } else {
            // Backfill places fields when missing.
            const placePatch: Record<string, unknown> = {};
            if (!p.hours_json && d.hours_osm) placePatch.hours_json = { raw: d.hours_osm, source: 'yelp' };
            if (!p.phone && d.phone) placePatch.phone = d.phone;
            if (!p.address && d.display_address && d.display_address.length > 0) {
              placePatch.address = d.display_address.join(', ');
            }
            if (Object.keys(placePatch).length > 0) {
              const { error: updErr } = await sb.from('places').update(placePatch).eq('id', p.id);
              if (!updErr) {
                if (placePatch.hours_json) hoursBackfilled++;
                if (placePatch.phone) phoneBackfilled++;
                if (placePatch.address) addressBackfilled++;
              }
            }

            // Synthetic review: only insert if Yelp gave us a rating.
            if (ours10 > 0 && d.review_count > 0) {
              const { error: insErr } = await sb.from('reviews').insert({
                place_id: p.id,
                user_id: SYS_USER_ID,
                overall_rating: ours10,
                comment: `Imported from Yelp (${d.review_count} ratings${d.price ? `, ${d.price}` : ''}).`,
                geo_verified: false,
                source: 'yelp',
                source_weight: 0.5,
              });
              if (!insErr) reviewsInserted++;
            }

          }
        }
      }
    } catch (err) {
      errored++;
      console.error(`  ✗ ${p.name}: ${err instanceof Error ? err.message : err}`);
    }
    if ((i + 1) % 50 === 0) {
      console.log(
        `[yelp] ${i + 1}/${candidates.length} · matched=${matched} skipped=${skipped} hrs+=${hoursBackfilled} phone+=${phoneBackfilled} addr+=${addressBackfilled} rev+=${reviewsInserted} err=${errored}`,
      );
    }
    if (SLEEP_MS > 0 && i + 1 < candidates.length) await sleep(SLEEP_MS);
  }

  console.log(
    `\n[yelp] done. matched=${matched} skipped=${skipped} hrs+=${hoursBackfilled} phone+=${phoneBackfilled} addr+=${addressBackfilled} rev+=${reviewsInserted} err=${errored}` +
      (DRY_RUN ? ' (dry run)' : ''),
  );
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) fail(`${name} is missing`);
  return v;
}

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
