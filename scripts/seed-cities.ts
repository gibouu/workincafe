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
  // (Toronto + Mississauga + Brampton + Markham + Vaughan + Richmond Hill +
  // Oakville). South bound dropped to 43.40 to reach Oakville's lakeshore.
  { key: 'toronto',    label: 'Toronto (GTA)', country: 'CA', mode: 'full',      bbox: [43.40, -79.84, 43.96, -78.96] },
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

  // ── France-wide cafe seed (Refs #128) ────────────────────────────────────
  // 13 metropolitan regions. Île-de-France overlaps the existing 'paris'
  // seed but dedup on normalized_name_hash makes the re-insert a no-op for
  // Paris café rows; other categories (bakery/library/hotel/restaurant) in
  // Paris stay seeded only by 'paris'. Region bboxes are loose — Overpass
  // queries can take 60-180s each at ~5°×5° span; sequential runs with
  // existing 5s polite delay finish in ~15-25 min total.
  { key: 'fr-idf',        label: 'Île-de-France',          country: 'FR', mode: 'cafe-only', bbox: [48.12, 1.45, 49.24, 3.56] },
  { key: 'fr-aura',       label: 'Auvergne-Rhône-Alpes',   country: 'FR', mode: 'cafe-only', bbox: [44.12, 2.00, 46.80, 7.20] },
  { key: 'fr-paca',       label: 'Provence-Alpes-Côte d\'Azur', country: 'FR', mode: 'cafe-only', bbox: [43.00, 4.23, 45.13, 7.72] },
  { key: 'fr-nouvelle-aquitaine', label: 'Nouvelle-Aquitaine', country: 'FR', mode: 'cafe-only', bbox: [42.78, -1.79, 46.62, 2.61] },
  { key: 'fr-occitanie',  label: 'Occitanie',              country: 'FR', mode: 'cafe-only', bbox: [42.33, -0.33, 45.05, 4.85] },
  { key: 'fr-hauts-de-france', label: 'Hauts-de-France',   country: 'FR', mode: 'cafe-only', bbox: [49.10, 1.38, 51.10, 4.25] },
  { key: 'fr-grand-est',  label: 'Grand Est',              country: 'FR', mode: 'cafe-only', bbox: [47.42, 3.39, 50.17, 8.23] },
  { key: 'fr-pays-de-la-loire', label: 'Pays de la Loire', country: 'FR', mode: 'cafe-only', bbox: [46.20, -2.55, 48.57, 0.91] },
  { key: 'fr-normandie',  label: 'Normandie',              country: 'FR', mode: 'cafe-only', bbox: [48.18, -1.95, 50.07, 1.79] },
  { key: 'fr-bretagne',   label: 'Bretagne',               country: 'FR', mode: 'cafe-only', bbox: [47.27, -5.14, 48.91, -1.01] },
  { key: 'fr-bfc',        label: 'Bourgogne-Franche-Comté', country: 'FR', mode: 'cafe-only', bbox: [46.16, 2.83, 48.40, 7.16] },
  { key: 'fr-cvl',        label: 'Centre-Val de Loire',    country: 'FR', mode: 'cafe-only', bbox: [46.34, 0.06, 48.95, 3.10] },
  { key: 'fr-corse',      label: 'Corse',                  country: 'FR', mode: 'cafe-only', bbox: [41.33, 8.54, 43.02, 9.56] },
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
          'way["amenity"~"^(cafe|library|fast_food|restaurant|coworking_space|ice_cream|internet_cafe|bar|biergarten|pub)$"]',
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
