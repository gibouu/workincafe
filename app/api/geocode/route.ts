import { NextResponse, type NextRequest } from 'next/server';

/**
 * GET /api/geocode?q=<text>&lat=&lng=&bbox=w,s,e,n
 *
 * Proxies Photon (OSM-based, free, no key) to surface neighborhoods,
 * parks, streets, and landmarks for the search bar's "Locations"
 * section. Bias params (lat/lng/bbox) are taken from the current map
 * viewport so a search for "République" doesn't return Dominican
 * Republic results when looking at Paris.
 *
 * Soft-fails to an empty array on transport errors so the search bar
 * never breaks — places search keeps working.
 */

const PHOTON_ENDPOINT =
  process.env.PHOTON_ENDPOINT ?? 'https://photon.komoot.io/api';

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

function parseFloatOrNull(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

function parseBbox(raw: string | null): [number, number, number, number] | null {
  if (!raw) return null;
  const parts = raw.split(',').map((s) => Number.parseFloat(s.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [w, s, e, n] = parts;
  if (w < -180 || e > 180 || s < -90 || n > 90 || w > e || s > n) return null;
  return [w, s, e, n];
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const lat = parseFloatOrNull(url.searchParams.get('lat'));
  const lng = parseFloatOrNull(url.searchParams.get('lng'));
  const bbox = parseBbox(url.searchParams.get('bbox'));

  const photonUrl = new URL(PHOTON_ENDPOINT);
  photonUrl.searchParams.set('q', q);
  photonUrl.searchParams.set('limit', '15');
  if (lat !== null && lng !== null) {
    photonUrl.searchParams.set('lat', String(lat));
    photonUrl.searchParams.set('lon', String(lng));
  }
  if (bbox) {
    photonUrl.searchParams.set('bbox', bbox.join(','));
  }

  let resp: Response;
  try {
    resp = await fetch(photonUrl.toString(), {
      headers: {
        // Photon mirrors reject unidentified UA strings.
        'user-agent': 'workincafe/0.1 (https://workin.cafe; ops@workin.cafe)',
        accept: 'application/json',
      },
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
    const [lngOut, latOut] = f.geometry.coordinates;
    results.push({
      kind,
      label,
      lat: latOut,
      lng: lngOut,
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
