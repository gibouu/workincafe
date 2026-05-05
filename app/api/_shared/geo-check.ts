import { haversineMeters } from '@/lib/geo';

// Geo gate for review / live-update / check-in submissions. 500 m is the
// trade-off: tight enough that you'd need to be on the same block as the
// venue to fake "I am here", loose enough to absorb normal phone-GPS error
// (routinely 100–300 m off in dense cities, indoors, or near tall
// buildings). 150 m — the original value — punished people whose GPS was
// just being normal-bad.
export const GEO_VERIFY_METERS = 500;

export function isWithin(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  meters = GEO_VERIFY_METERS,
): boolean {
  return haversineMeters(a, b) <= meters;
}
