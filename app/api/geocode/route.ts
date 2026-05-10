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
    housenumber?: string;
    district?: string;
    locality?: string;
    type?: string;
  };
}

interface PhotonResponse {
  features?: PhotonFeature[];
}

type GeocodeKind = 'address' | 'neighborhood' | 'park' | 'street' | 'landmark';

/** Filter to result kinds the user is plausibly searching for as a
 *  destination — addresses, neighborhoods, parks, streets, and major
 *  landmarks. Individual venues (cafés, restaurants) come from the
 *  place search instead. Returns null for anything else. */
function classify(feature: PhotonFeature): GeocodeKind | null {
  const k = feature.properties.osm_key;
  const v = feature.properties.osm_value;
  // Photon tags numbered street addresses as place=house with a housenumber
  // property. Surface them as "address" so users can paste a full address
  // ("10 Rue de Rivoli") and click straight to that spot.
  if (k === 'place' && v === 'house' && feature.properties.housenumber) {
    return 'address';
  }
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

function labelFor(feature: PhotonFeature, kind: GeocodeKind): string {
  const p = feature.properties;
  if (kind === 'address' && p.housenumber && p.street) {
    return `${p.housenumber} ${p.street}`;
  }
  if (p.name) return p.name;
  if (p.street) return p.street;
  return [p.type, p.city, p.country].filter(Boolean).join(', ');
}

function subLabelFor(feature: PhotonFeature, kind: GeocodeKind, label: string): string | null {
  const p = feature.properties;
  if (kind === 'address') {
    // Stack district / locality / city for context — "Le Marais, Paris".
    return [p.district ?? p.locality, p.city].filter(Boolean).filter((s) => s !== label).join(', ') || null;
  }
  return p.city && p.city !== label ? p.city : null;
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

  const results: { kind: GeocodeKind; label: string; lat: number; lng: number; subLabel: string | null }[] = [];
  const seen = new Set<string>();
  for (const f of json.features) {
    const kind = classify(f);
    if (!kind) continue;
    const label = labelFor(f, kind);
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
      subLabel: subLabelFor(f, kind, label),
    });
    if (results.length >= 8) break;
  }

  return NextResponse.json(
    { results },
    { headers: { 'cache-control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  );
}
