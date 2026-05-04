/**
 * Work in Cafe — one-shot migration of legacy review photos to Cloudinary.
 *
 * Reads `review_photos` rows that still reference the Supabase
 * `review-photos` bucket (cloudinary_public_id IS NULL, path IS NOT NULL),
 * downloads each image, uploads it to Cloudinary under the same
 * `reviews/<reviewId>/<slot>` namespace the live form uses, and writes the
 * resulting public_id + version back to the row.
 *
 * Usage:
 *   tsx --env-file=.env.local scripts/migrate-photos-to-cloudinary.ts
 *   tsx --env-file=.env.local scripts/migrate-photos-to-cloudinary.ts --dry-run
 *
 * Idempotent — already-migrated rows are skipped. Once every row is migrated
 * (or those that error out have been triaged), drop the Supabase bucket and
 * remove the legacy `path` column in a follow-up migration.
 *
 * Prereqs:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - CLOUDINARY_CLOUD_NAME (or NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME)
 *   - CLOUDINARY_API_KEY
 *   - CLOUDINARY_API_SECRET
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const DRY_RUN = process.argv.includes('--dry-run');

const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME ?? process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
if (!CLOUD_NAME) fail('CLOUDINARY_CLOUD_NAME is missing');
const API_KEY = requireEnv('CLOUDINARY_API_KEY');
const API_SECRET = requireEnv('CLOUDINARY_API_SECRET');

interface Row {
  review_id: string;
  slot: string;
  path: string | null;
  cloudinary_public_id: string | null;
}

interface CloudinaryUploadResponse {
  public_id: string;
  version: number;
  width: number;
  height: number;
  bytes: number;
  format: string;
}

async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data, error } = await sb
    .from('review_photos')
    .select('review_id, slot, path, cloudinary_public_id')
    .is('cloudinary_public_id', null)
    .not('path', 'is', null);
  if (error) fail(`Query failed: ${error.message}`);

  const rows = (data ?? []) as Row[];
  if (rows.length === 0) {
    console.log('Nothing to migrate — all rows already point at Cloudinary.');
    return;
  }
  console.log(`${DRY_RUN ? '[dry-run] ' : ''}Migrating ${rows.length} photo(s)…`);

  let ok = 0;
  let fails = 0;

  for (const row of rows) {
    if (!row.path) {
      fails++;
      continue;
    }
    const folder = `reviews/${row.review_id}`;
    const publicIdStem = sanitize(row.slot);

    try {
      const sourceUrl = `${SUPABASE_URL}/storage/v1/object/public/review-photos/${row.path}`;
      const fetched = await fetch(sourceUrl);
      if (!fetched.ok) throw new Error(`source fetch ${fetched.status}`);
      const blob = await fetched.blob();

      if (DRY_RUN) {
        console.log(`  · ${row.review_id}/${row.slot} (${blob.size} bytes) → ${folder}/${publicIdStem}`);
        ok++;
        continue;
      }

      const result = await uploadToCloudinary(blob, folder, publicIdStem);

      const { error: updateErr } = await sb
        .from('review_photos')
        .update({
          cloudinary_public_id: result.public_id,
          cloudinary_version: String(result.version),
          width: result.width ?? null,
          height: result.height ?? null,
          bytes: result.bytes ?? null,
        })
        .eq('review_id', row.review_id)
        .eq('slot', row.slot);
      if (updateErr) throw new Error(`db update: ${updateErr.message}`);

      console.log(`  ✓ ${row.review_id}/${row.slot} → ${result.public_id}@v${result.version}`);
      ok++;
    } catch (err) {
      fails++;
      console.error(`  ✗ ${row.review_id}/${row.slot}: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\nDone. ok=${ok} failed=${fails}${DRY_RUN ? ' (dry run)' : ''}`);
  if (fails > 0) process.exitCode = 1;
}

async function uploadToCloudinary(
  blob: Blob,
  folder: string,
  publicId: string,
): Promise<CloudinaryUploadResponse> {
  const timestamp = Math.floor(Date.now() / 1000);
  const params: Record<string, string | number> = {
    folder,
    public_id: publicId,
    timestamp,
  };
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  const signature = crypto.createHash('sha1').update(sorted + API_SECRET).digest('hex');

  const fd = new FormData();
  fd.append('file', blob);
  fd.append('api_key', API_KEY);
  fd.append('timestamp', String(timestamp));
  fd.append('signature', signature);
  fd.append('folder', folder);
  fd.append('public_id', publicId);

  const resp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: fd,
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`cloudinary ${resp.status}: ${body.slice(0, 200)}`);
  }
  return (await resp.json()) as CloudinaryUploadResponse;
}

function sanitize(s: string): string {
  return s.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64);
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
