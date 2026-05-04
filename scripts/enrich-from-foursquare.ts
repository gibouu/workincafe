/**
 * Work in Cafe — enrich places using the Foursquare Places API.
 *
 * For each place (filtered by --city), this script:
 *   1. Calls Foursquare match to find their record by name + lat/lng.
 *   2. Pulls details (rating /10, hours, popularity).
 *   3. Backfills places.hours_json when our row had no OSM hours.
 *   4. Inserts a synthetic review (source='foursquare', source_weight=0.5).
 *      The review's overall_rating is the Foursquare rating; we map other
 *      buckets only when we have signal.
 *
 * Run order recommended by the user: Toronto first, Paris over the next
 * couple of days as the daily quota allows.
 *
 * Usage:
 *   npm run enrich:foursquare -- --city=toronto --dry-run
 *   npm run enrich:foursquare -- --city=toronto --limit=500
 *   npm run enrich:foursquare -- --city=paris
 *
 * Idempotent: a place that already has a foursquare-source review is
 * skipped on re-runs (unique (place_id, source) lookup).
 */

import { createClient } from '@supabase/supabase-js';
import { matchByLocation, fetchDetails } from '../lib/places/foursquare';

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
const LIMIT = Math.max(1, Math.min(50000, Number(argMap.get('limit') ?? 5000)));
const SLEEP_MS = Math.max(50, Number(argMap.get('sleep') ?? 220));

if (!CITY) fail('--city=paris|toronto is required');

const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const FSQ_KEY = requireEnv('FOURSQUARE_API_KEY');

interface PlaceRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
  hours_json: { raw?: string } | null;
}

async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Skip places that already have a foursquare review attached.
  const { data: enrichedRows } = await sb
    .from('reviews')
    .select('place_id')
    .eq('source', 'foursquare')
    .eq('user_id', SYS_USER_ID);
  const enriched = new Set<string>((enrichedRows ?? []).map((r) => (r as { place_id: string }).place_id));
  console.log(`[fsq] already enriched: ${enriched.size}`);

  // Pull places to enrich. We prioritize categories users actually work
  // from: cafés / bakeries / libraries / coworking / hotels — restaurants
  // and fast_food are skipped because we don't review them.
  const PAGE = 1000;
  let from = 0;
  const candidates: PlaceRow[] = [];
  while (candidates.length < LIMIT) {
    const need = LIMIT - candidates.length;
    const take = Math.min(PAGE, need);
    const { data, error } = await sb
      .from('places')
      .select('id, name, lat, lng, hours_json')
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
  console.log(`[fsq] candidates after dedup: ${candidates.length} (city=${CITY})`);

  let matched = 0;
  let skipped = 0;
  let errored = 0;
  let hoursBackfilled = 0;
  let reviewsInserted = 0;

  for (let i = 0; i < candidates.length; i++) {
    const p = candidates[i];
    try {
      const m = await matchByLocation(FSQ_KEY, p.name, p.lat, p.lng);
      if (!m) {
        skipped++;
      } else {
        const d = await fetchDetails(FSQ_KEY, m.fsq_id);
        if (!d) {
          skipped++;
        } else {
          matched++;
          if (DRY_RUN) {
            console.log(
              `  · ${p.name} → ${m.name} (${m.distance_m}m, rating=${d.rating ?? '—'}, hours=${d.hours_osm ? 'yes' : 'no'})`,
            );
          } else {
            // Backfill hours if we had none.
            if (!p.hours_json && d.hours_osm) {
              const { error: updErr } = await sb
                .from('places')
                .update({ hours_json: { raw: d.hours_osm, source: 'foursquare' } })
                .eq('id', p.id);
              if (!updErr) hoursBackfilled++;
            }
            // Synthetic review row. We only fill overall_rating; other
            // buckets stay null so they don't pollute means until a real
            // user reviews. comment carries provenance for transparency.
            if (typeof d.rating === 'number') {
              const { error: insErr } = await sb.from('reviews').insert({
                place_id: p.id,
                user_id: SYS_USER_ID,
                overall_rating: Math.round(Math.max(1, Math.min(10, d.rating))),
                comment: `Imported from Foursquare (${d.total_ratings ?? 0} ratings).`,
                geo_verified: false,
                source: 'foursquare',
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
        `[fsq] ${i + 1}/${candidates.length} · matched=${matched} skipped=${skipped} hrs+=${hoursBackfilled} rev+=${reviewsInserted} err=${errored}`,
      );
    }
    if (SLEEP_MS > 0 && i + 1 < candidates.length) await sleep(SLEEP_MS);
  }

  console.log(
    `\n[fsq] done. matched=${matched} skipped=${skipped} hrs+=${hoursBackfilled} rev+=${reviewsInserted} err=${errored}${DRY_RUN ? ' (dry run)' : ''}`,
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
