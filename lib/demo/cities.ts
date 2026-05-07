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

export function currencySymbol(city: City): string {
  switch (city) {
    case 'paris':
      return '€';
    case 'toronto':
      return 'C$';
  }
}

export function cityForPlace(placeId: string): City {
  if (TORONTO_DEMO_PLACES.some((p) => p.id === placeId)) return 'toronto';
  return 'paris';
}

/**
 * Resolve an IP-geo city/country pair to one of our known cities. Tries the
 * city label first (case-insensitive); falls back to country code when the
 * label is missing or doesn't match. Returns `null` for IPs that don't fall
 * into a city we ship today. See #18.
 */
export function matchKnownCity(
  city: string | null | undefined,
  country: string | null | undefined,
): City | null {
  if (city) {
    const lc = city.toLowerCase();
    for (const meta of Object.values(CITIES)) {
      if (meta.label.toLowerCase() === lc) return meta.id;
    }
  }
  if (country) {
    const cc = country.toUpperCase();
    // Single-city-per-country mapping is fine for MVP — both Paris (FR) and
    // Toronto (CA) are the only cities we ship in their respective countries.
    for (const meta of Object.values(CITIES)) {
      if (meta.country === cc) return meta.id;
    }
  }
  return null;
}
