import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/places/search?q=foo&city=Paris&limit=10
 * pg_trgm on places.name + address ILIKE.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const city = searchParams.get('city');
  const limit = Math.min(25, Number(searchParams.get('limit') ?? 10));
  if (!q || q.length < 2) return NextResponse.json({ places: [] });

  const supabase = await createClient();
  let query = supabase
    .from('places')
    .select('id, name, address, city, neighborhood, category, brand, lat, lng')
    .or(`name.ilike.%${q}%,address.ilike.%${q}%`)
    .limit(limit);

  if (city) query = query.eq('city', city);

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
