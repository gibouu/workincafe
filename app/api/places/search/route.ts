import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/places/search?q=foo&bbox=w,s,e,n&limit=10
 *
 * pg_trgm on places.name + address ILIKE. Optional bbox biases search
 * to the current map viewport so the same query returns local hits
 * first; without bbox the search is global.
 */
function parseBbox(raw: string | null): [number, number, number, number] | null {
  if (!raw) return null;
  const parts = raw.split(',').map((s) => Number.parseFloat(s.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [w, s, e, n] = parts;
  if (w < -180 || e > 180 || s < -90 || n > 90 || w > e || s > n) return null;
  return [w, s, e, n];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const bbox = parseBbox(searchParams.get('bbox'));
  const limit = Math.min(25, Number(searchParams.get('limit') ?? 10));
  if (!q || q.length < 2) return NextResponse.json({ places: [] });

  const supabase = await createClient();
  let query = supabase
    .from('places')
    .select('id, name, address, city, neighborhood, category, brand, lat, lng')
    .or(`name.ilike.%${q}%,address.ilike.%${q}%`)
    .limit(limit);

  if (bbox) {
    const [w, s, e, n] = bbox;
    query = query.gte('lng', w).lte('lng', e).gte('lat', s).lte('lat', n);
  }

  const { data, error } = await query;
  if (error) {
    if (/relation .* does not exist/i.test(error.message)) {
      return NextResponse.json({ places: [], warning: 'places table not migrated yet' });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(
    { places: data ?? [] },
    { headers: { 'cache-control': 'public, s-maxage=30, stale-while-revalidate=120' } },
  );
}
