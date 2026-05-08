import { NextResponse, type NextRequest } from 'next/server';

/**
 * GET /api/geocode?city=paris|toronto&q=<text>
 *
 * Proxies Photon (OSM-based, free, no key) to surface neighborhoods,
 * parks, streets, and landmarks for the search bar's "Locations"
 * section. Bbox-bounded to the active city so a search for "République"
 * doesn't return Dominican Republic results. See #103.
 *
 * Soft-fails to an empty array on transport errors so the search bar
 * never breaks — places search keeps working.
 */

const PHOTON_ENDPOINT =
  process.env.PHOTON_ENDPOINT ?? 'https://photon.komoot.io/api';

interface CityBox {
  // Bias point at city centre; bbox is the rectangular hint Photon uses
  // to rank results. Loose enough to include the whole metro area.
  lat: number;
  lng: number;
  bbox: [number, number, number, number]; // minLng, minLat, maxLng, maxLat
}

const CITIES: Record<string, CityBox> = {
  paris: {
    lat: 48.8566,
    lng: 2.3522,
    bbox: [2.224, 48.815, 2.470, 48.902],
  },
  toronto: {
    lat: 43.6532,
    lng: -79.3832,
    bbox: [-79.640, 43.581, -79.116, 43.855],
  },
};

interface PhotonFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    osm_key?: string;
    osm_value?: string;
    name?: string;
    city?: string;
    state?: string;
    country?: string;
    street?: string;
    type?: string;
  };
}

interface PhotonResponse {
  features?: PhotonFeature[];
}

/** Filter to result kinds the user is plausibly searching for as an
 *  *area*, not as an individual venue (which the place search covers).
 *  Returns null for anything we want to drop. */
function classify(feature: PhotonFeature): 'neighborhood' | 'park' | 'street' | 'landmark' | null {
  const k = feature.properties.osm_key;
  const v = feature.properties.osm_value;
  if (k === 'place' && /^(suburb|neighbourhood|quarter|district|borough|town|village|hamlet)$/.test(v ?? '')) {
    return 'neighborhood';
  }
  if (k === 'leisure' && (v === 'park' || v === 'garden' || v === 'nature_reserve')) {
    return 'park';
  }
  if (k === 'highway' && /^(primary|secondary|tertiary|residential|pedestrian|living_street)$/.test(v ?? '')) {
    return 'street';
  }
  if (k === 'tourism' && (v === 'attraction' || v === 'museum' || v === 'viewpoint')) {
    return 'landmark';
  }
  if (k === 'historic') {
    return 'landmark';
  }
  return null;
}

function labelFor(feature: PhotonFeature): string {
  const p = feature.properties;
  if (p.name) return p.name;
  if (p.street) return p.street;
  return [p.type, p.city, p.country].filter(Boolean).join(', ');
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const cityKey = (url.searchParams.get('city') ?? '').toLowerCase();
  const q = (url.searchParams.get('q') ?? '').trim();
  const cityCfg = CITIES[cityKey];

  if (!cityCfg) {
    return NextResponse.json({ error: 'city must be paris or toronto' }, { status: 400 });
  }
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const photonUrl = new URL(PHOTON_ENDPOINT);
  photonUrl.searchParams.set('q', q);
  photonUrl.searchParams.set('lat', String(cityCfg.lat));
  photonUrl.searchParams.set('lon', String(cityCfg.lng));
  photonUrl.searchParams.set('limit', '15');
  photonUrl.searchParams.set('bbox', cityCfg.bbox.join(','));

  let resp: Response;
  try {
    resp = await fetch(photonUrl.toString(), {
      headers: {
        // Photon mirrors reject unidentified UA strings.
        'user-agent': 'workincafe/0.1 (https://workin.cafe; ops@workin.cafe)',
        accept: 'application/json',
      },
      // Cache the upstream response — same query within 60s reuses.
      next: { revalidate: 60 },
    });
  } catch {
    return NextResponse.json({ results: [] });
  }
  if (!resp.ok) {
    return NextResponse.json({ results: [] });
  }
  const json = (await resp.json().catch(() => null)) as PhotonResponse | null;
  if (!json?.features) {
    return NextResponse.json({ results: [] });
  }

  const results: { kind: string; label: string; lat: number; lng: number; subLabel: string | null }[] = [];
  const seen = new Set<string>();
  for (const f of json.features) {
    const kind = classify(f);
    if (!kind) continue;
    const label = labelFor(f);
    if (!label) continue;
    const dedupKey = `${kind}:${label.toLowerCase()}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    const [lng, lat] = f.geometry.coordinates;
    results.push({
      kind,
      label,
      lat,
      lng,
      // Sub-label gives the user enough context to disambiguate two
      // streets with the same name in different arrondissements.
      subLabel:
        f.properties.city && f.properties.city !== label
          ? f.properties.city
          : null,
    });
    if (results.length >= 8) break;
  }

  return NextResponse.json(
    { results },
    { headers: { 'cache-control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  );
}
