import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { PlaceCategory } from '@/lib/categories';

interface SlimPlaceRow {
  id: string;
  name: string;
  address: string | null;
  neighborhood: string | null;
  category: PlaceCategory;
  lat: number;
  lng: number;
  brand: string | null;
  user_validated_at: string | null;
  membership_required: string | null;
}

const MAX_SLIM = 5000;

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
  const bbox = parseBbox(url.searchParams.get('bbox'));
  if (!bbox) {
    return NextResponse.json({ error: 'bbox required (w,s,e,n)' }, { status: 400 });
  }

  const supabase = await createClient();
  const [w, s, e, n] = bbox;
  const { data, error } = await supabase
    .from('places')
    .select(
      'id, name, address, neighborhood, category, lat, lng, brand, user_validated_at, membership_required',
    )
    .gte('lng', w)
    .lte('lng', e)
    .gte('lat', s)
    .lte('lat', n)
    .limit(MAX_SLIM);
  if (error) {
    const code = (error as { code?: string }).code ?? '';
    // Demo-mode contract: missing table or columns → empty payload so the
    // client falls back to demo arrays without crashing.
    if (code === '42P01' || code === '42703') return NextResponse.json({ places: [] });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const slimPlaces = (data ?? []) as SlimPlaceRow[];
  interface SlimRatingRow {
    place_id: string;
    study_spot_rating: number | null;
    user_rating_count: number;
  }
  const ratingByPlace = new Map<string, SlimRatingRow>();
  if (slimPlaces.length > 0) {
    const { data: ratingRows } = await supabase
      .from('mv_place_ratings')
      .select('place_id, study_spot_rating, user_rating_count')
      .in('place_id', slimPlaces.map((p) => p.id))
      .limit(MAX_SLIM);
    for (const r of (ratingRows ?? []) as SlimRatingRow[]) {
      ratingByPlace.set(r.place_id, r);
    }
  }

  const out = slimPlaces.map((p) => {
    const r = ratingByPlace.get(p.id);
    const hasUserReviews = (r?.user_rating_count ?? 0) > 0;
    const userValidated = Boolean(p.user_validated_at);
    return {
      id: p.id,
      name: p.name,
      address: p.address ?? '',
      neighborhood: p.neighborhood ?? '',
      category: p.category,
      lat: p.lat,
      lng: p.lng,
      brand: p.brand,
      rating: r?.study_spot_rating ?? 0,
      has_user_reviews: hasUserReviews,
      is_validated: hasUserReviews || userValidated,
      membership_required: p.membership_required ?? null,
    };
  });

  return NextResponse.json(
    { places: out, total: out.length, slim: true },
    { headers: { 'cache-control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  );
}
