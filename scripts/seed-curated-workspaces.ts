/**
 * Curated workspace-gym seeder (#127).
 *
 * Reads `lib/curated/workspace-gyms.ts` and upserts each entry into
 * `places`. Idempotent via normalized_name_hash + place_source_refs
 * (source='curated', external_id=normalized_name_hash).
 *
 * Usage:
 *   npm run seed:curated
 *
 * Prereqs:
 *   - NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   - Migration 025 (membership_required column) applied.
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { CURATED_WORKSPACES, type CuratedWorkspace } from '../lib/curated/workspace-gyms';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

const hashKey = (name: string, lat: number, lng: number) =>
  crypto
    .createHash('sha1')
    .update(`${normalize(name)}|${lat.toFixed(4)}|${lng.toFixed(4)}`)
    .digest('hex')
    .slice(0, 16);

interface PlaceInsert {
  name: string;
  address: string | null;
  city: string;
  country: string;
  lat: number;
  lng: number;
  category: string;
  brand: string | null;
  website: string | null;
  membership_required: string | null;
  normalized_name_hash: string;
}

function toRow(w: CuratedWorkspace): PlaceInsert {
  return {
    name: w.name,
    address: w.address || null,
    city: w.city,
    country: w.country.toUpperCase(),
    lat: w.lat,
    lng: w.lng,
    category: w.category ?? 'coworking',
    brand: w.brand ?? null,
    website: w.website ?? null,
    membership_required: w.membership_required ?? null,
    normalized_name_hash: hashKey(w.name, w.lat, w.lng),
  };
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE env (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).');
  }
  if (CURATED_WORKSPACES.length === 0) {
    console.log('[curated] no entries in lib/curated/workspace-gyms.ts — nothing to seed.');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const rows = CURATED_WORKSPACES.map(toRow);
  console.log(`[curated] seeding ${rows.length} curated workspace(s)…`);

  // Sanity check coordinates — bail early on obviously-wrong (0, 0)
  // placeholders so we don't pollute the DB with stub rows.
  const bad = rows.filter((r) => r.lat === 0 && r.lng === 0);
  if (bad.length > 0) {
    console.error(
      `[curated] aborting — ${bad.length} entries have (0, 0) coordinates:`,
      bad.map((r) => r.name).join(', '),
    );
    process.exit(1);
  }

  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await supabase
      .from('places')
      .upsert(batch, { onConflict: 'normalized_name_hash' });
    if (error) throw error;

    const refs = batch.map((r) => ({
      source: 'curated',
      external_id: r.normalized_name_hash,
      normalized_name_hash: r.normalized_name_hash,
    }));
    const { error: refsErr } = await supabase
      .from('place_source_refs')
      .upsert(refs, { onConflict: 'source,external_id' });
    if (refsErr) throw refsErr;

    console.log(`[curated] upserted ${Math.min(i + 50, rows.length)}/${rows.length}`);
  }

  console.log(`[curated] done — ${rows.length} rows upserted.`);
}

main().catch((err) => {
  console.error('[curated] fatal', err);
  process.exit(1);
});
