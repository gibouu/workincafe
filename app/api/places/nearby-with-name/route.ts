import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/places/nearby-with-name?lat=&lng=&q=&radius_m=150
 *
 * Returns places near (lat, lng) whose name is similar to `q` via pg_trgm
 * similarity. Drives the add-place wizard's "Did you mean…?" cards so
 * users see existing-but-hidden rows before submitting a duplicate
 * place_request. See #82.
 *
 * Public (no auth). Soft-fails to empty array on missing tables / columns
 * so the wizard never breaks against a freshly-cloned project.
 */

const MAX_LIMIT = 10;
const DEFAULT_RADIUS_M = 150;
const MAX_RADIUS_M = 500;
const MIN_SIMILARITY = 0.3;

// Approximate metres per degree for a quick bbox prefilter. Latitude is
// constant; longitude shrinks toward the poles. The filter is intentionally
// generous — pg_trgm + ST_DWithin would be cleaner but require PostGIS
// chained in a way that's overkill for ≤10-row replies.
const METRES_PER_DEG_LAT = 111_320;

function lngDegPerMetre(lat: number): number {
  return 1 / (METRES_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
}

interface MatchRow {
  id: string;
  name: string;
  category: string | null;
  brand: string | null;
  lat: number;
  lng: number;
  similarity: number;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const lat = Number.parseFloat(url.searchParams.get('lat') ?? '');
  const lng = Number.parseFloat(url.searchParams.get('lng') ?? '');
  const q = (url.searchParams.get('q') ?? '').trim();
  const radiusRaw = Number.parseInt(url.searchParams.get('radius_m') ?? '', 10);
  const radius = Number.isFinite(radiusRaw)
    ? Math.min(MAX_RADIUS_M, Math.max(50, radiusRaw))
    : DEFAULT_RADIUS_M;

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }
  if (!q || q.length < 2) {
    return NextResponse.json({ matches: [] });
  }

  const dLat = radius / METRES_PER_DEG_LAT;
  const dLng = radius * lngDegPerMetre(lat);
  const minLat = lat - dLat;
  const maxLat = lat + dLat;
  const minLng = lng - dLng;
  const maxLng = lng + dLng;

  const supabase = await createClient();

  // pg_trgm `similarity()` is the easiest scoring function and works
  // without an index for this row count (bbox prefilter caps the set).
  // Wrapped in an RPC-style raw SQL via Supabase's `.rpc` would be
  // cleaner but requires defining a function; doing it inline via
  // postgrest-rpc keeps the migration footprint zero.
  const { data, error } = await supabase
    .rpc('places_nearby_with_name', {
      p_lat_min: minLat,
      p_lat_max: maxLat,
      p_lng_min: minLng,
      p_lng_max: maxLng,
      p_query: q,
      p_min_similarity: MIN_SIMILARITY,
      p_limit: MAX_LIMIT,
    })
    .returns<MatchRow[]>();

  if (error) {
    const code = (error as { code?: string }).code ?? '';
    const message = (error as { message?: string }).message ?? '';
    // Soft-fail when the RPC or table doesn't exist (fresh clone, demo
    // mode). The wizard treats an empty array as "no duplicates found".
    if (
      code === '42883' /* function does not exist */ ||
      code === '42P01' /* table does not exist */ ||
      /function .* does not exist/i.test(message) ||
      /relation .* does not exist/i.test(message)
    ) {
      return NextResponse.json({ matches: [] });
    }
    return NextResponse.json({ error: message || 'lookup failed' }, { status: 500 });
  }

  return NextResponse.json(
    { matches: data ?? [] },
    { headers: { 'cache-control': 'private, max-age=15' } },
  );
}
