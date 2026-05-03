import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { PlaceCategory } from '@/lib/categories';

interface PlaceRow {
  id: string;
  name: string;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  country: string | null;
  category: PlaceCategory;
  lat: number;
  lng: number;
  brand: string | null;
}

interface RatingRow {
  place_id: string;
  study_spot_rating: number | null;
  rating_count: number;
}

const MAX_PER_REQUEST = 2500;

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const cityParam = (url.searchParams.get('city') ?? '').toLowerCase();
  const cityName = cityParam === 'paris' ? 'Paris' : cityParam === 'toronto' ? 'Toronto' : null;
  if (!cityName) {
    return NextResponse.json({ error: 'city must be paris or toronto' }, { status: 400 });
  }

  const supabase = await createClient();

  // Pull places filtered by city. Paris has ~7400, Toronto ~4500 — the
  // map can comfortably render 2-3k clustered markers; we slice to the
  // safety cap so the response stays under ~300 KB.
  const { data: rawPlaces, error: pErr } = await supabase
    .from('places')
    .select('id, name, address, neighborhood, city, country, category, lat, lng, brand')
    .eq('city', cityName)
    .order('name', { ascending: true })
    .limit(MAX_PER_REQUEST);

  if (pErr) {
    const code = (pErr as { code?: string }).code ?? '';
    if (code === '42P01') return NextResponse.json({ places: [] });
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }
  const places = (rawPlaces ?? []) as PlaceRow[];

  // Best-effort join with mv_place_ratings (might not be refreshed yet).
  const { data: ratings } = await supabase
    .from('mv_place_ratings')
    .select('place_id, study_spot_rating, rating_count')
    .in('place_id', places.map((p) => p.id))
    .limit(MAX_PER_REQUEST);

  const ratingByPlace = new Map<string, RatingRow>();
  for (const r of (ratings ?? []) as RatingRow[]) ratingByPlace.set(r.place_id, r);

  // Adapt DB shape → DemoPlace shape so the map / sidebar / card render
  // without changes. Buckets default to mid-tier; live updates and reviews
  // overwrite them as data comes in.
  const out = places.map((p) => {
    const r = ratingByPlace.get(p.id);
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
      review_count: r?.rating_count ?? 0,
      avg_spend_eur: 0,
      wifi: 'moderate' as const,
      noise: 'moderate' as const,
      outlets: 'some' as const,
      seats: 'some' as const,
      lighting: 'good' as const,
      tabletime_hours: 0,
      right_now_noise: 'No recent live updates',
      right_now_seating: 'No recent live updates',
    };
  });

  return NextResponse.json({ places: out, total: out.length });
}
