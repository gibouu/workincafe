/**
 * Work in Cafe — backfill places.phone / website / address from Foursquare.
 *
 * The 2025 Foursquare API put rating + hours behind a paid tier. The free
 * tier still returns the place's address, phone, website, and chain
 * affiliation, which is useful when OSM didn't tag those fields.
 *
 * For ratings + hours we use Yelp instead (`scripts/enrich-from-yelp.ts`).
 *
 * Usage:
 *   npm run enrich:foursquare -- --city=toronto --dry-run --limit=20
 *   npm run enrich:foursquare -- --city=toronto
 *   npm run enrich:foursquare -- --city=paris --limit=2000
 *
 * Idempotent: skips places that already have phone AND website AND address.
 */

import { createClient } from '@supabase/supabase-js';
import { matchEnrichment } from '../lib/places/foursquare';

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
  address: string | null;
  phone: string | null;
  website: string | null;
  brand: string | null;
}

async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Pull places we'd want to enrich. We prioritize work-friendly categories
  // (cafe / bakery / library / coworking / hotel) and skip places that
  // already have phone + website + address — nothing left to fill in.
  const PAGE = 1000;
  let from = 0;
  const candidates: PlaceRow[] = [];
  while (candidates.length < LIMIT) {
    const need = LIMIT - candidates.length;
    const take = Math.min(PAGE, need);
    const { data, error } = await sb
      .from('places')
      .select('id, name, lat, lng, address, phone, website, brand')
      .eq('city', CITY!)
      .in('category', ['cafe', 'bakery', 'library', 'coworking', 'hotel'])
      .order('id')
      .range(from, from + take - 1);
    if (error) fail(`select places: ${error.message}`);
    const rows = (data ?? []) as PlaceRow[];
    if (rows.length === 0) break;
    for (const r of rows) {
      // Skip if all three contact fields are already filled.
      if (r.address && r.phone && r.website) continue;
      candidates.push(r);
    }
    if (rows.length < take) break;
    from += rows.length;
  }
  console.log(`[fsq] candidates: ${candidates.length} (city=${CITY})`);

  let matched = 0;
  let skipped = 0;
  let errored = 0;
  let updated = 0;
  let phoneAdded = 0;
  let websiteAdded = 0;
  let addressAdded = 0;
  let brandAdded = 0;

  for (let i = 0; i < candidates.length; i++) {
    const p = candidates[i];
    try {
      const m = await matchEnrichment(FSQ_KEY, p.name, p.lat, p.lng);
      if (!m) {
        skipped++;
      } else {
        matched++;
        const patch: Record<string, string> = {};
        if (!p.address && m.formatted_address) {
          patch.address = m.formatted_address;
          addressAdded++;
        }
        if (!p.phone && m.tel) {
          patch.phone = m.tel;
          phoneAdded++;
        }
        if (!p.website && m.website) {
          patch.website = m.website;
          websiteAdded++;
        }
        if (!p.brand && m.chain_name) {
          patch.brand = m.chain_name;
          brandAdded++;
        }
        const fields = Object.keys(patch);
        if (fields.length === 0) {
          // Matched but no new info.
        } else if (DRY_RUN) {
          console.log(`  · ${p.name} ← ${m.name} → backfill ${fields.join(', ')}`);
        } else {
          const { error: updErr } = await sb.from('places').update(patch).eq('id', p.id);
          if (!updErr) updated++;
        }
      }
    } catch (err) {
      errored++;
      console.error(`  ✗ ${p.name}: ${err instanceof Error ? err.message : err}`);
    }
    if ((i + 1) % 50 === 0) {
      console.log(
        `[fsq] ${i + 1}/${candidates.length} · matched=${matched} skipped=${skipped} updated=${updated} err=${errored}`,
      );
    }
    if (SLEEP_MS > 0 && i + 1 < candidates.length) await sleep(SLEEP_MS);
  }

  console.log(
    `\n[fsq] done. matched=${matched} skipped=${skipped} updated=${updated} err=${errored}` +
      `  · phone+=${phoneAdded} website+=${websiteAdded} address+=${addressAdded} brand+=${brandAdded}` +
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
