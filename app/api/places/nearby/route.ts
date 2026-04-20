import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/places/nearby?bbox=minLng,minLat,maxLng,maxLat&category=cafe,bakery&limit=200
 * Returns places inside the bbox. Empty array if no DB rows yet.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const bboxRaw = searchParams.get('bbox');
  const categories = searchParams.get('category')?.split(',').filter(Boolean);
  const limit = Math.min(500, Number(searchParams.get('limit') ?? 200));

  if (!bboxRaw) {
    return NextResponse.json({ error: 'bbox required (minLng,minLat,maxLng,maxLat)' }, { status: 400 });
  }
  const parts = bboxRaw.split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return NextResponse.json({ error: 'invalid bbox' }, { status: 400 });
  }
  const [minLng, minLat, maxLng, maxLat] = parts;

  const supabase = await createClient();
  let query = supabase
    .from('places')
    .select('id, name, address, city, neighborhood, category, brand, lat, lng, featured')
    .gte('lat', minLat)
    .lte('lat', maxLat)
    .gte('lng', minLng)
    .lte('lng', maxLng)
    .limit(limit);

  if (categories && categories.length > 0) {
    query = query.in('category', categories as never[]);
  }

  const { data, error } = await query;
  if (error) {
    // Table may not exist yet — return empty gracefully.
    if (/relation .* does not exist/i.test(error.message)) {
      return NextResponse.json({ places: [], warning: 'places table not migrated yet' });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { places: data ?? [] },
    { headers: { 'cache-control': 'private, max-age=30' } },
  );
}
