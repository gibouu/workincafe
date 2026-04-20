import { haversineMeters } from '@/lib/geo';

export const GEO_VERIFY_METERS = 150;

export function isWithin(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  meters = GEO_VERIFY_METERS,
): boolean {
  return haversineMeters(a, b) <= meters;
}
