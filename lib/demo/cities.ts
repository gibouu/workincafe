import { PARIS_DEMO_PLACES, type DemoPlace } from '@/lib/demo/paris-places';
import { TORONTO_DEMO_PLACES } from '@/lib/demo/toronto-places';

export type City = 'paris' | 'toronto';

export interface CityMeta {
  id: City;
  label: string;
  country: string;
  center: { lat: number; lng: number };
  places: DemoPlace[];
}

export const CITIES: Record<City, CityMeta> = {
  paris: {
    id: 'paris',
    label: 'Paris',
    country: 'FR',
    center: { lat: 48.8566, lng: 2.3522 },
    places: PARIS_DEMO_PLACES,
  },
  toronto: {
    id: 'toronto',
    label: 'Toronto',
    country: 'CA',
    center: { lat: 43.6532, lng: -79.3832 },
    places: TORONTO_DEMO_PLACES,
  },
};

export function findPlace(id: string): DemoPlace | undefined {
  return (
    PARIS_DEMO_PLACES.find((p) => p.id === id) ??
    TORONTO_DEMO_PLACES.find((p) => p.id === id)
  );
}

// Maximum great-circle distance from a city centre at which an IP that
// resolved to that point still maps to that city. Most metros sprawl ~30 km
// from the centroid; 80 km generously covers commuter belts (Mississauga →
// Toronto, Versailles → Paris). See #49.
const CITY_RADIUS_KM = 80;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Resolve an IP-geo signal to one of our known cities. Three-tier matcher:
 *
 *   1. City label (case-insensitive). Catches "Toronto", "toronto", etc.
 *   2. Country code. Catches an IP that returned no city but does have CA/FR.
 *      Single-city-per-country mapping is fine while we ship Paris + Toronto;
 *      revisit when the global expansion in #50 lands more cities per country.
 *   3. Coordinate radius. Closest city centre within `CITY_RADIUS_KM`. Lets
 *      "Kitchener, ON" → Toronto and "Versailles, FR" → Paris when the
 *      label match misses but the IP geo is still in the metro.
 *
 * Returns `null` when none of the three tiers fire.
 *
 * See #18 (original silent auto-switch), #48 (soft prompt), #49 (this tier).
 */
export function matchKnownCity(
  city: string | null | undefined,
  country: string | null | undefined,
  coords?: { lat: number; lng: number } | null,
): City | null {
  if (city) {
    const lc = city.toLowerCase();
    for (const meta of Object.values(CITIES)) {
      if (meta.label.toLowerCase() === lc) return meta.id;
    }
  }
  if (country) {
    const cc = country.toUpperCase();
    for (const meta of Object.values(CITIES)) {
      if (meta.country === cc) return meta.id;
    }
  }
  if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
    let best: { id: City; distance: number } | null = null;
    for (const meta of Object.values(CITIES)) {
      const distance = haversineKm(coords.lat, coords.lng, meta.center.lat, meta.center.lng);
      if (distance <= CITY_RADIUS_KM && (!best || distance < best.distance)) {
        best = { id: meta.id, distance };
      }
    }
    if (best) return best.id;
  }
  return null;
}
