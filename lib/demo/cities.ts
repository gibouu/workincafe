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
