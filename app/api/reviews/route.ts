import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isWithin } from '@/app/api/_shared/geo-check';

interface Body {
  place_id?: string;
  overall_rating?: number;
  wifi_rating?: number;
  noise_rating?: number;
  seating_rating?: number;
  outlets_rating?: number;
  price_rating?: number;
  atmosphere_rating?: number;
  food_rating?: number;
  temperature_rating?: number;
  comment?: string;
  verified_lat?: number;
  verified_lng?: number;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.place_id || typeof body.overall_rating !== 'number') {
    return NextResponse.json({ error: 'place_id and overall_rating required' }, { status: 400 });
  }
  if (typeof body.verified_lat !== 'number' || typeof body.verified_lng !== 'number') {
    return NextResponse.json({ error: 'verified_lat/verified_lng required' }, { status: 400 });
  }

  const { data: place, error: pErr } = await supabase
    .from('places')
    .select('lat, lng')
    .eq('id', body.place_id)
    .maybeSingle();
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!place) return NextResponse.json({ error: 'place not found' }, { status: 404 });

  const geoVerified = isWithin(
    { lat: body.verified_lat, lng: body.verified_lng },
    { lat: place.lat, lng: place.lng },
  );
  if (!geoVerified) {
    return NextResponse.json(
      { error: `too far from the place (must be within 150m)` },
      { status: 400 },
    );
  }

  // Anti-abuse: 5 reviews/user/day max
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count: todayCount } = await supabase
    .from('reviews')
    .select('id', { head: true, count: 'exact' })
    .eq('user_id', user.id)
    .gte('created_at', todayStart.toISOString());
  if ((todayCount ?? 0) >= 5) {
    return NextResponse.json({ error: 'daily review limit reached' }, { status: 429 });
  }

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      place_id: body.place_id,
      user_id: user.id,
      overall_rating: body.overall_rating,
      wifi_rating: body.wifi_rating ?? null,
      noise_rating: body.noise_rating ?? null,
      seating_rating: body.seating_rating ?? null,
      outlets_rating: body.outlets_rating ?? null,
      price_rating: body.price_rating ?? null,
      atmosphere_rating: body.atmosphere_rating ?? null,
      food_rating: body.food_rating ?? null,
      temperature_rating: body.temperature_rating ?? null,
      comment: body.comment?.slice(0, 280) ?? null,
      geo_verified: true,
      verified_lat: body.verified_lat,
      verified_lng: body.verified_lng,
    })
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id });
}
