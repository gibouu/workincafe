/**
 * Seed-city config for the OSM Overpass bulk seed.
 *
 *   - `mode: 'full'`     → all categories (cafe, bakery, library, coworking,
 *                         hotel, restaurant, fast_food). Used for the two
 *                         curated launch cities + Istanbul (greenfield).
 *   - `mode: 'cafe-only'` → amenity=cafe + shop=coffee|tea only. Used for
 *                         the cafe-only global expansion (Refs #50, #113).
 *                         Other categories grow via user-submitted places.
 *
 * bbox is [south, west, north, east] in WGS84. Used directly in the Overpass
 * `(s,w,n,e)` filter — no admin-polygon lookup, so multi-municipality regions
 * (GTA, SF Bay Area, LA metro) work uniformly.
 */
export type SeedMode = 'full' | 'cafe-only';

export interface SeedCity {
  key: string;
  label: string;
  country: string; // ISO 3166-1 alpha-2
  mode: SeedMode;
  bbox: [number, number, number, number]; // [south, west, north, east]
}

export const SEED_CITIES: SeedCity[] = [
  // ── Launch cities (full categories) ──────────────────────────────────────
  { key: 'paris',      label: 'Paris',         country: 'FR', mode: 'full',      bbox: [48.815, 2.224, 48.902, 2.470] },
  // Toronto: bbox expanded from City-of-Toronto admin polygon to the GTA core
  // (Toronto + Mississauga + Brampton + Markham + Vaughan + Richmond Hill).
  // Excludes the wider commuter belt (Halton/Durham/Hamilton).
  { key: 'toronto',    label: 'Toronto (GTA)', country: 'CA', mode: 'full',      bbox: [43.49, -79.84, 43.96, -78.96] },
  { key: 'istanbul',   label: 'Istanbul',      country: 'TR', mode: 'full',      bbox: [40.80, 28.65, 41.20, 29.35] },

  // ── Cafe-only expansion (Refs #50, #113) ─────────────────────────────────
  { key: 'nyc',        label: 'New York',      country: 'US', mode: 'cafe-only', bbox: [40.49, -74.27, 40.92, -73.68] },
  { key: 'london',     label: 'London',        country: 'GB', mode: 'cafe-only', bbox: [51.28, -0.51, 51.69, 0.33] },
  { key: 'berlin',     label: 'Berlin',        country: 'DE', mode: 'cafe-only', bbox: [52.34, 13.09, 52.68, 13.76] },
  { key: 'zurich',     label: 'Zürich',        country: 'CH', mode: 'cafe-only', bbox: [47.32, 8.45, 47.43, 8.62] },
  { key: 'auckland',   label: 'Auckland',      country: 'NZ', mode: 'cafe-only', bbox: [-36.99, 174.55, -36.69, 174.97] },
  { key: 'lisbon',     label: 'Lisbon',        country: 'PT', mode: 'cafe-only', bbox: [38.69, -9.23, 38.80, -9.09] },
  { key: 'copenhagen', label: 'Copenhagen',    country: 'DK', mode: 'cafe-only', bbox: [55.61, 12.45, 55.73, 12.65] },
  { key: 'sydney',     label: 'Sydney',        country: 'AU', mode: 'cafe-only', bbox: [-34.10, 150.80, -33.69, 151.34] },
  { key: 'reykjavik',  label: 'Reykjavík',     country: 'IS', mode: 'cafe-only', bbox: [64.10, -22.00, 64.18, -21.75] },
  { key: 'madrid',     label: 'Madrid',        country: 'ES', mode: 'cafe-only', bbox: [40.32, -3.83, 40.55, -3.55] },
  // SF Bay Area: SF + Oakland + Berkeley + Peninsula + South Bay (San Jose).
  // Excludes the outer commuter belt (Santa Cruz, Vallejo, Livermore).
  { key: 'sfbay',      label: 'SF Bay Area',   country: 'US', mode: 'cafe-only', bbox: [37.20, -122.55, 38.00, -121.65] },
  { key: 'la',         label: 'Los Angeles',   country: 'US', mode: 'cafe-only', bbox: [33.70, -118.67, 34.34, -117.66] },
  { key: 'boston',     label: 'Boston',        country: 'US', mode: 'cafe-only', bbox: [42.23, -71.20, 42.45, -70.92] },
  { key: 'miami',      label: 'Miami',         country: 'US', mode: 'cafe-only', bbox: [25.55, -80.50, 26.00, -80.10] },
  { key: 'seoul',      label: 'Seoul',         country: 'KR', mode: 'cafe-only', bbox: [37.42, 126.76, 37.70, 127.18] },
  { key: 'tokyo',      label: 'Tokyo',         country: 'JP', mode: 'cafe-only', bbox: [35.53, 139.56, 35.82, 139.92] },
  { key: 'osaka',      label: 'Osaka',         country: 'JP', mode: 'cafe-only', bbox: [34.55, 135.40, 34.75, 135.65] },
  { key: 'singapore',  label: 'Singapore',     country: 'SG', mode: 'cafe-only', bbox: [1.20, 103.59, 1.48, 104.05] },
  { key: 'dubai',      label: 'Dubai',         country: 'AE', mode: 'cafe-only', bbox: [25.00, 55.05, 25.40, 55.55] },
];

export function getSeedCity(key: string): SeedCity | undefined {
  return SEED_CITIES.find((c) => c.key === key);
}

export function buildOverpassQuery(city: SeedCity): string {
  const [s, w, n, e] = city.bbox;
  const filters =
    city.mode === 'full'
      ? [
          'node["amenity"~"^(cafe|library|fast_food|restaurant|coworking_space|ice_cream|internet_cafe)$"]',
          'node["shop"~"^(bakery|coffee|tea|pastry)$"]',
          'node["tourism"~"^(hotel|hostel|guest_house|motel)$"]',
          'way["amenity"~"^(cafe|library|fast_food|restaurant|coworking_space|ice_cream|internet_cafe)$"]',
          'way["shop"~"^(bakery|coffee|tea|pastry)$"]',
          'way["tourism"~"^(hotel|hostel|guest_house|motel)$"]',
        ]
      : [
          // cafe-only: amenity=cafe + shop=coffee|tea (specialty roasters /
          // teahouses). Excluded: ice_cream, internet_cafe, bakery, pastry —
          // user wants cafes + cafe chains specifically.
          'node["amenity"="cafe"]',
          'node["shop"~"^(coffee|tea)$"]',
          'way["amenity"="cafe"]',
          'way["shop"~"^(coffee|tea)$"]',
        ];
  const body = filters.map((f) => `  ${f}(${s},${w},${n},${e});`).join('\n');
  return `[out:json][timeout:300];\n(\n${body}\n);\nout body center;`;
}
