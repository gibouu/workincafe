/**
 * Seed-city config for the OSM Overpass bulk seed.
 *
 * The product is six cities (#194): Paris, Toronto (GTA), London, New York,
 * Tokyo, Seoul. Re-adding a city is one entry here + one seed run.
 *
 *   - `mode: 'full'`      → all categories (cafe, bakery, library, coworking,
 *                          hotel, restaurant, fast_food). Used for the two
 *                          curated launch cities.
 *   - `mode: 'work-core'` → the default-view categories only: amenity=cafe +
 *                          shop=coffee|tea + libraries + coworking. Other
 *                          categories grow via user-submitted places.
 *
 * bbox is [south, west, north, east] in WGS84. Used directly in the Overpass
 * `(s,w,n,e)` filter — no admin-polygon lookup, so multi-municipality regions
 * (GTA) work uniformly.
 */
export type SeedMode = 'full' | 'work-core';

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
  // (Toronto + Mississauga + Brampton + Markham + Vaughan + Richmond Hill +
  // Oakville). South bound dropped to 43.40 to reach Oakville's lakeshore.
  { key: 'toronto',    label: 'Toronto (GTA)', country: 'CA', mode: 'full',      bbox: [43.40, -79.84, 43.96, -78.96] },

  // ── Work-core cities (#194) ──────────────────────────────────────────────
  { key: 'nyc',        label: 'New York',      country: 'US', mode: 'work-core', bbox: [40.49, -74.27, 40.92, -73.68] },
  { key: 'london',     label: 'London',        country: 'GB', mode: 'work-core', bbox: [51.28, -0.51, 51.69, 0.33] },
  { key: 'tokyo',      label: 'Tokyo',         country: 'JP', mode: 'work-core', bbox: [35.53, 139.56, 35.82, 139.92] },
  { key: 'seoul',      label: 'Seoul',         country: 'KR', mode: 'work-core', bbox: [37.42, 126.76, 37.70, 127.18] },
];

export function getSeedCity(key: string): SeedCity | undefined {
  return SEED_CITIES.find((c) => c.key === key);
}

export function buildOverpassQuery(city: SeedCity): string {
  const [s, w, n, e] = city.bbox;
  const filters =
    city.mode === 'full'
      ? [
          // amenity=bar|biergarten|pub added in #126 — many Parisian
          // brasseries / Toronto pubs are work-conducive in the afternoon.
          // The hours filter (isWorkConducive) drops dinner-only / late-
          // night dives; daytime venues survive.
          'node["amenity"~"^(cafe|library|fast_food|restaurant|coworking_space|ice_cream|internet_cafe|bar|biergarten|pub)$"]',
          'node["shop"~"^(bakery|coffee|tea|pastry)$"]',
          'node["tourism"~"^(hotel|hostel|guest_house|motel)$"]',
          // office=coworking is how most coworking spaces are actually tagged
          // in OSM; amenity=coworking_space is the rare legacy tag (#194).
          'node["office"="coworking"]',
          'way["amenity"~"^(cafe|library|fast_food|restaurant|coworking_space|ice_cream|internet_cafe|bar|biergarten|pub)$"]',
          'way["shop"~"^(bakery|coffee|tea|pastry)$"]',
          'way["tourism"~"^(hotel|hostel|guest_house|motel)$"]',
          'way["office"="coworking"]',
        ]
      : [
          // work-core: the default-view categories — cafes (amenity=cafe +
          // shop=coffee|tea specialty roasters / teahouses), libraries, and
          // coworking. Excluded: ice_cream, internet_cafe, bakery, pastry.
          'node["amenity"~"^(cafe|library|coworking_space)$"]',
          'node["shop"~"^(coffee|tea)$"]',
          'node["office"="coworking"]',
          'way["amenity"~"^(cafe|library|coworking_space)$"]',
          'way["shop"~"^(coffee|tea)$"]',
          'way["office"="coworking"]',
        ];
  const body = filters.map((f) => `  ${f}(${s},${w},${n},${e});`).join('\n');
  return `[out:json][timeout:300];\n(\n${body}\n);\nout body center;`;
}
