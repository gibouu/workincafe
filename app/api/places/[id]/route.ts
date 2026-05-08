import { NextResponse } from 'next/server';
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
  hours_json: { raw?: string } | null;
  user_validated_at: string | null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from('places')
    .select(
      'id, name, address, neighborhood, city, country, category, lat, lng, brand, hours_json, user_validated_at',
    )
    .eq('id', id)
    .maybeSingle();

  if (error) {
    if (
      /relation .* does not exist/i.test(error.message) ||
      /column .* does not exist/i.test(error.message)
    ) {
      return NextResponse.json({ error: 'not migrated' }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const r = row as PlaceRow;

  const [{ data: rating }, { data: liveStatus }] = await Promise.all([
    supabase.from('mv_place_ratings').select('*').eq('place_id', id).maybeSingle(),
    supabase.from('mv_current_live_status').select('*').eq('place_id', id).maybeSingle(),
  ]);

  // Adapt to the DemoPlace shape so the card / sidebar render without a
  // second mapping layer. Ratings come from the materialized view; live
  // status drives the "Right now" line.
  const ratingObj = rating as
    | {
        study_spot_rating?: number;
        rating_count?: number;
        user_rating_count?: number;
        coffee_mean?: number | null;
        coffee_review_count?: number;
      }
    | null;
  const liveStatusObj = liveStatus as { noise?: string; seating?: string } | null;
  const hasUserReviews = (ratingObj?.user_rating_count ?? 0) > 0;
  const userValidated = Boolean(r.user_validated_at);
  const place = {
    id: r.id,
    name: r.name,
    address: r.address ?? '',
    neighborhood: r.neighborhood ?? '',
    category: r.category,
    lat: r.lat,
    lng: r.lng,
    brand: r.brand,
    rating: ratingObj?.study_spot_rating ?? 0,
    review_count: ratingObj?.rating_count ?? 0,
    has_user_reviews: hasUserReviews,
    is_validated: hasUserReviews || userValidated,
    coffee_rating: ratingObj?.coffee_mean ?? null,
    coffee_review_count: ratingObj?.coffee_review_count ?? 0,
    avg_spend_eur: 0,
    wifi: 'unknown' as const,
    noise: 'unknown' as const,
    outlets: 'unknown' as const,
    seats: 'unknown' as const,
    lighting: 'unknown' as const,
    tabletime_hours: 0,
    right_now_noise: liveStatusObj?.noise ?? 'No recent live updates',
    right_now_seating: liveStatusObj?.seating ?? 'No recent live updates',
    hours_raw: r.hours_json?.raw ?? null,
  };

  return NextResponse.json(
    { place, rating: rating ?? null, liveStatus: liveStatus ?? null },
    { headers: { 'cache-control': 'public, s-maxage=30, stale-while-revalidate=300' } },
  );
}
