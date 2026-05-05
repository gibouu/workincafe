import { NextResponse, type NextRequest } from 'next/server';
import {
  getRequestActor,
  insertWithDemoFlag,
  resolvePlaceIdForActor,
} from '@/lib/auth/request-actor';
import { isWithin, GEO_VERIFY_METERS } from '@/app/api/_shared/geo-check';
import { rateLimit } from '@/lib/rate-limit';

interface Body {
  place_id?: string;
  overall_rating?: number;
  overall_suggested?: number | null;
  overall_user_set?: boolean;
  wifi_rating?: number | null;
  noise_rating?: number | null;
  seating_rating?: number | null;
  outlets_rating?: number | null;
  food_rating?: number | null;
  food_value_rating?: number | null;
  current_busyness?: number | null;
  temperature_feel?: number | null;
  drink_price_range?: string | null;
  food_price_range?: string | null;
  ate_food?: boolean;
  environment_facts?: string[];
  work_facts?: string[];
  place_type?: string | null;
  current_seating?: string | null;
  outside_temp_c?: number | null;
  outside_condition?: string | null;
  comment?: string | null;
  verified_lat?: number;
  verified_lng?: number;
}

function isValidRating10(value: unknown): value is number | null {
  if (value === null || value === undefined) return true;
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10;
}

export async function POST(request: NextRequest) {
  const { db, user, isDemo } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  // 5/min per user — a real review takes longer than 12s to fill out.
  // Caps fast-script abuse without bothering legitimate reviewers.
  const rl = rateLimit('reviews', user.id, { capacity: 5, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'too many reviews — slow down' },
      { status: 429, headers: { 'retry-after': String(rl.retryAfterSec) } },
    );
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.place_id || typeof body.overall_rating !== 'number') {
    return NextResponse.json({ error: 'place_id and overall_rating required' }, { status: 400 });
  }
  if (typeof body.verified_lat !== 'number' || typeof body.verified_lng !== 'number') {
    return NextResponse.json({ error: 'verified_lat/verified_lng required' }, { status: 400 });
  }

  const ratingFields: [string, unknown][] = [
    ['overall_rating', body.overall_rating],
    ['overall_suggested', body.overall_suggested ?? null],
    ['wifi_rating', body.wifi_rating ?? null],
    ['noise_rating', body.noise_rating ?? null],
    ['seating_rating', body.seating_rating ?? null],
    ['outlets_rating', body.outlets_rating ?? null],
    ['food_rating', body.food_rating ?? null],
    ['food_value_rating', body.food_value_rating ?? null],
    ['current_busyness', body.current_busyness ?? null],
    ['temperature_feel', body.temperature_feel ?? null],
  ];
  for (const [name, value] of ratingFields) {
    if (!isValidRating10(value)) {
      return NextResponse.json(
        { error: `${name} must be an integer 1-10 or null` },
        { status: 400 },
      );
    }
  }

  const placeId = await resolvePlaceIdForActor(db, body.place_id, isDemo);

  const { data: place, error: pErr } = await db
    .from('places')
    .select('lat, lng')
    .eq('id', placeId)
    .maybeSingle();
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!place) return NextResponse.json({ error: 'place not found' }, { status: 404 });

  const geoVerified = isWithin(
    { lat: body.verified_lat, lng: body.verified_lng },
    { lat: place.lat, lng: place.lng },
  );
  if (!geoVerified) {
    return NextResponse.json(
      { error: `too far from the place (must be within ${GEO_VERIFY_METERS}m)` },
      { status: 400 },
    );
  }

  // Anti-abuse: 5 reviews/user/day max
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count: todayCount } = await db
    .from('reviews')
    .select('id', { head: true, count: 'exact' })
    .eq('user_id', user.id)
    .gte('created_at', todayStart.toISOString());
  if ((todayCount ?? 0) >= 5) {
    return NextResponse.json({ error: 'daily review limit reached' }, { status: 429 });
  }

  const { data, error } = await insertWithDemoFlag(
    db,
    'reviews',
    {
      place_id: placeId,
      user_id: user.id,
      overall_rating: body.overall_rating,
      overall_suggested: body.overall_suggested ?? null,
      overall_user_set: body.overall_user_set ?? null,
      wifi_rating: body.wifi_rating ?? null,
      noise_rating: body.noise_rating ?? null,
      seating_rating: body.seating_rating ?? null,
      outlets_rating: body.outlets_rating ?? null,
      food_rating: body.food_rating ?? null,
      food_value_rating: body.food_value_rating ?? null,
      current_busyness: body.current_busyness ?? null,
      temperature_feel: body.temperature_feel ?? null,
      drink_price_range: body.drink_price_range ?? null,
      food_price_range: body.food_price_range ?? null,
      ate_food: body.ate_food ?? null,
      environment_facts: body.environment_facts ?? null,
      work_facts: body.work_facts ?? null,
      place_type: body.place_type ?? null,
      current_seating: body.current_seating ?? null,
      outside_temp_c: body.outside_temp_c ?? null,
      outside_condition: body.outside_condition ?? null,
      comment: body.comment?.slice(0, 280) ?? null,
      geo_verified: true,
      verified_lat: body.verified_lat,
      verified_lng: body.verified_lng,
    },
    isDemo,
  );

  if (error) {
    const code = (error as { code?: string }).code ?? '';
    const message = (error as { message?: string }).message ?? '';
    // Demo-mode contract: missing table or columns → soft 503 so the form
    // shows the success state and the demo surface keeps working.
    if (code === '42P01' || /relation .* does not exist/i.test(message)) {
      return NextResponse.json({ error: 'table missing' }, { status: 503 });
    }
    if (code === '42703' || /column .* does not exist/i.test(message)) {
      return NextResponse.json({ error: 'column missing' }, { status: 503 });
    }
    return NextResponse.json({ error: message || 'insert failed' }, { status: 500 });
  }
  return NextResponse.json({ id: data?.id });
}
