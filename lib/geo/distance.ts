/** Great-circle distance in kilometres between two lat/lng pairs.
 *  Mean Earth radius (WGS84-ish) is good to ~0.5% — fine for "sort the
 *  sidebar list by distance from this anchor". Lifted from app/(map)/page.tsx
 *  so the sidebar can use it too. See #103. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const clamped = Math.min(1, Math.max(0, a));
  return 2 * R * Math.asin(Math.sqrt(clamped));
}
