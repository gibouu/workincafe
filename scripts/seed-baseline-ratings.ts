/**
 * Work in Cafe — seed system-source preliminary ratings.
 *
 * Inserts a synthetic review for every place that currently has zero
 * reviews. The rating is computed from category + chain heuristics in
 * `lib/places/category-rating.ts`. Each row carries source='system',
 * source_weight=0.5 so a single user review pulls the score and ten user
 * reviews dilute the baseline to ~5%.
 *
 * Idempotent — re-runs skip places that already have any review (real or
 * synthetic).
 *
 * Usage:
 *   npm run seed:baseline -- --dry-run
 *   npm run seed:baseline -- --city=toronto   # any SEED_CITIES key
 *   npm run seed:baseline                     # all cities
 *
 * --city resolves through SEED_CITIES and filters by bbox, not by the
 * `city` label — labels are fragmented (suburbs, "Toronto (GTA)", the
 * relabeled Paris rows), so spatial filtering is the only reliable
 * scope. Same approach as the #194 purge.
 */

import { createClient } from '@supabase/supabase-js';
import { categoryBaseline, quantize } from '../lib/places/category-rating';
import { SEED_CITIES, getSeedCity } from './seed-cities';

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
const SEED_CITY = CITY_ARG ? getSeedCity(CITY_ARG) : null;
if (CITY_ARG !== undefined && !SEED_CITY) {
  fail(
    `unsupported --city value "${CITY_ARG}". Use one of: ${SEED_CITIES.map((c) => c.key).join(', ')}.`,
  );
}

const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

interface PlaceRow {
  id: string;
  name: string;
  category: string;
  city: string | null;
}

async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Pull places to seed. Excludes restaurants/fast_food because we don't
  // recommend them as work spots (filtered out by other parts of the app).
  // Skips places that already have any review to keep the script idempotent.
  const PAGE = 1000;
  let from = 0;
  const all: PlaceRow[] = [];
  while (true) {
    let q = sb
      .from('places')
      .select('id, name, category, city')
      .in('category', ['cafe', 'bakery', 'library', 'coworking', 'hotel'])
      .order('id')
      .range(from, from + PAGE - 1);
    if (SEED_CITY) {
      const [s, w, n, e] = SEED_CITY.bbox;
      q = q.gte('lat', s).lte('lat', n).gte('lng', w).lte('lng', e);
    }
    const { data, error } = await q;
    if (error) fail(`select places: ${error.message}`);
    const rows = (data ?? []) as PlaceRow[];
    all.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  console.log(`[baseline] places fetched: ${all.length}${SEED_CITY ? ` (city=${SEED_CITY.key})` : ''}`);

  // Find which already have any review.
  const ids = all.map((r) => r.id);
  const reviewed = new Set<string>();
  const ID_CHUNK = 200;
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const slice = ids.slice(i, i + ID_CHUNK);
    const { data, error } = await sb.from('reviews').select('place_id').in('place_id', slice);
    if (error) fail(`select reviews: ${error.message}`);
    for (const r of data ?? []) reviewed.add((r as { place_id: string }).place_id);
  }
  console.log(`[baseline] already reviewed (skipping): ${reviewed.size}`);

  const targets = all.filter((p) => !reviewed.has(p.id));
  console.log(`[baseline] to seed: ${targets.length}`);

  if (targets.length === 0) {
    console.log('Nothing to seed.');
    return;
  }

  // Bucket by rating for a quick distribution sanity check.
  const buckets = new Map<number, number>();
  const rows = targets.map((p) => {
    const baseline = categoryBaseline(p.category, p.name);
    const q = quantize(baseline.rating);
    buckets.set(q, (buckets.get(q) ?? 0) + 1);
    return {
      place_id: p.id,
      user_id: SYS_USER_ID,
      overall_rating: q,
      comment: `Preliminary rating (${baseline.reason}). Replaced as visitors review.`,
      geo_verified: false,
      source: 'system',
      source_weight: 0.5,
    };
  });

  console.log(
    '[baseline] rating distribution: ' +
      [...buckets.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([r, n]) => `${r}=${n}`)
        .join(', '),
  );

  if (DRY_RUN) {
    console.log('\n[baseline] sample (first 10):');
    for (const t of targets.slice(0, 10)) {
      const b = categoryBaseline(t.category, t.name);
      console.log(`  · ${t.city}/${t.category}: ${t.name} → ${quantize(b.rating)} (${b.reason})`);
    }
    console.log('\nDry run — no rows inserted.');
    return;
  }

  // Insert in batches.
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const { error } = await sb.from('reviews').insert(slice);
    if (error) fail(`insert batch ${i}: ${error.message}`);
    inserted += slice.length;
    console.log(`[baseline] inserted ${inserted}/${rows.length}`);
  }
  console.log(`Done. Seeded ${inserted} preliminary review(s).`);
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
