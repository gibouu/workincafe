/**
 * Work in Cafe — one-shot prune of OSM-tagged hotels that are actually
 * apartment buildings or student housing.
 *
 * Selects rows in `places` where category='hotel' and the name matches
 * the apartment / student-housing heuristic. Skips rows with reviews,
 * check-ins, or live updates so user contributions are never destroyed.
 *
 * Usage:
 *   npm run prune:residences -- --dry-run
 *   npm run prune:residences
 */

import { createClient } from '@supabase/supabase-js';
import { looksLikeApartmentBuilding } from '../lib/places/looks-like-apartment';

const DRY_RUN = process.argv.includes('--dry-run');

const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

interface Row {
  id: string;
  name: string;
  city: string | null;
}

async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const PAGE = 1000;
  let from = 0;
  const all: Row[] = [];
  while (true) {
    const { data, error } = await sb
      .from('places')
      .select('id, name, city')
      .eq('category', 'hotel')
      .range(from, from + PAGE - 1);
    if (error) fail(`select: ${error.message}`);
    const rows = (data ?? []) as Row[];
    all.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  console.log(`[prune] hotel candidates fetched: ${all.length}`);

  const wouldDrop = all.filter((r) => looksLikeApartmentBuilding(r.name));
  console.log(`[prune] flagged as apartment/student housing: ${wouldDrop.length}`);
  if (wouldDrop.length === 0) {
    console.log('Nothing to prune.');
    return;
  }

  // Protect rows that have user contributions.
  const ids = wouldDrop.map((r) => r.id);
  const protectedIds = new Set<string>();
  const ID_CHUNK = 200;
  for (const table of ['reviews', 'checkins', 'live_updates']) {
    for (let i = 0; i < ids.length; i += ID_CHUNK) {
      const slice = ids.slice(i, i + ID_CHUNK);
      const { data, error } = await sb.from(table).select('place_id').in('place_id', slice);
      if (error) {
        const message = (error as { message?: string }).message ?? '';
        fail(`select ${table}: ${message || JSON.stringify(error)}`);
      }
      for (const r of data ?? []) protectedIds.add((r as { place_id: string }).place_id);
    }
  }

  const targets = wouldDrop.filter((r) => !protectedIds.has(r.id));
  const protectedCount = wouldDrop.length - targets.length;
  if (protectedCount > 0) {
    console.log(`[prune] protected (have user contributions): ${protectedCount}`);
  }
  console.log(`[prune] will delete: ${targets.length}`);

  const byCity: Record<string, number> = {};
  for (const t of targets) {
    const c = t.city ?? '∅';
    byCity[c] = (byCity[c] ?? 0) + 1;
  }
  console.log(
    `[prune] by city: ${Object.entries(byCity)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ')}`,
  );

  if (DRY_RUN) {
    console.log('\n[prune] sample (first 20):');
    for (const t of targets.slice(0, 20)) console.log(`  · ${t.city}: ${t.name}`);
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
