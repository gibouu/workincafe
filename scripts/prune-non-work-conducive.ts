/**
 * Work in Cafe — one-shot prune of non-work-conducive restaurants.
 *
 * Selects rows in `places` where category ∈ (restaurant, fast_food) and the
 * place originated from OSM (osm_tags.osm_id is set), then runs each through
 * `isWorkConducive` against the saved `hours_json.raw`. Failing rows are
 * deleted in batches.
 *
 * Safety:
 *   - Skips any place that has reviews, check-ins, or live updates so user
 *     contributions are never destroyed (we leave the row in place even if
 *     the hours look bad — operators can deal with it manually).
 *   - --dry-run prints the kill list without touching the database.
 *
 * Usage:
 *   npm run prune:hours -- --dry-run
 *   npm run prune:hours
 */

import { createClient } from '@supabase/supabase-js';
import { isWorkConducive } from '../lib/places/work-conducive';

const DRY_RUN = process.argv.includes('--dry-run');

const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

interface PlaceRow {
  id: string;
  name: string;
  city: string | null;
  category: string;
  hours_json: { raw?: string } | null;
}

async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const PAGE = 1000;
  let from = 0;
  const candidates: PlaceRow[] = [];

  while (true) {
    const { data, error } = await sb
      .from('places')
      .select('id, name, city, category, hours_json, osm_tags')
      .in('category', ['restaurant', 'fast_food', 'fast_food_burger'])
      .not('osm_tags->osm_id', 'is', null)
      .range(from, from + PAGE - 1);
    if (error) fail(`select failed: ${error.message}`);
    const rows = (data ?? []) as PlaceRow[];
    candidates.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }

  console.log(`[prune] candidates fetched: ${candidates.length}`);

  // Apply the filter in memory.
  const wouldDrop: PlaceRow[] = [];
  for (const row of candidates) {
    const raw = row.hours_json?.raw ?? null;
    if (!isWorkConducive(row.category, raw)) wouldDrop.push(row);
  }
  console.log(`[prune] flagged by hours filter: ${wouldDrop.length}`);

  if (wouldDrop.length === 0) {
    console.log('Nothing to prune.');
    return;
  }

  // Filter out anything with user contributions. PostgREST `IN` is bounded
  // by URL length so we batch.
  const ids = wouldDrop.map((r) => r.id);
  const protectedIds = new Set<string>();
  const ID_CHUNK = 200;
  for (const table of ['reviews', 'check_ins', 'live_updates']) {
    let missing = false;
    for (let i = 0; i < ids.length && !missing; i += ID_CHUNK) {
      const slice = ids.slice(i, i + ID_CHUNK);
      const { data, error } = await sb.from(table).select('place_id').in('place_id', slice);
      if (error) {
        const code = (error as { code?: string }).code ?? '';
        const message = (error as { message?: string }).message ?? '';
        // Soft-handle a missing table — early-stage envs may not have every
        // dependent table yet; we just don't protect against it.
        if (
          code === '42P01' ||
          code === 'PGRST205' ||
          /relation .* does not exist/i.test(message) ||
          /Could not find the table/i.test(message) ||
          /schema cache/i.test(message)
        ) {
          missing = true;
          break;
        }
        fail(`select ${table}: ${message || JSON.stringify(error)}`);
      }
      for (const r of data ?? []) protectedIds.add((r as { place_id: string }).place_id);
    }
    if (missing) console.log(`[prune] skipping protection lookup for missing table: ${table}`);
  }

  const targets = wouldDrop.filter((r) => !protectedIds.has(r.id));
  const protectedCount = wouldDrop.length - targets.length;
  if (protectedCount > 0) {
    console.log(`[prune] protected (have reviews/check-ins/live-updates): ${protectedCount}`);
  }
  console.log(`[prune] will delete: ${targets.length}`);

  // Per-category breakdown for sanity.
  const byCategory: Record<string, number> = {};
  const byCity: Record<string, number> = {};
  for (const t of targets) {
    byCategory[t.category] = (byCategory[t.category] ?? 0) + 1;
    const c = t.city ?? '∅';
    byCity[c] = (byCity[c] ?? 0) + 1;
  }
  console.log(
    `[prune] by category: ${Object.entries(byCategory)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ')}`,
  );
  console.log(
    `[prune] by city: ${Object.entries(byCity)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ')}`,
  );

  if (DRY_RUN) {
    const sample = targets.slice(0, 10);
    console.log('\n[prune] sample (first 10):');
    for (const t of sample) console.log(`  · ${t.category}/${t.city}: ${t.name}`);
    console.log(`\nDry run — no rows deleted. Re-run without --dry-run to commit.`);
    return;
  }

  const targetIds = targets.map((r) => r.id);
  const BATCH = 500;
  for (let i = 0; i < targetIds.length; i += BATCH) {
    const slice = targetIds.slice(i, i + BATCH);
    const { error } = await sb.from('places').delete().in('id', slice);
    if (error) fail(`delete batch ${i}: ${error.message}`);
    console.log(`[prune] deleted ${Math.min(i + BATCH, targetIds.length)}/${targetIds.length}`);
  }

  console.log(`Done. Deleted ${targetIds.length} place(s).`);
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
