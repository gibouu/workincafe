import crypto from 'node:crypto';

/**
 * Stable dedup key for a place: 16-char SHA1 of normalized name +
 * 4-decimal coordinates. MUST stay in lockstep with the seeder's
 * hashKey (scripts/seed-osm.ts) — both write places keyed on the
 * `normalized_name_hash` unique column.
 */
export function normalizedNameHash(name: string, lat: number, lng: number): string {
  const normalized = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
  return crypto
    .createHash('sha1')
    .update(`${normalized}|${lat.toFixed(4)}|${lng.toFixed(4)}`)
    .digest('hex')
    .slice(0, 16);
}
