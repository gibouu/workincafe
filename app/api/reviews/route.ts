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
  coffee_quality_rating?: number | null;
  coffee_art_rating?: number | null;
  coffee_mug_rating?: number | null;
  coffee_no_art?: boolean;
  coffee_no_mug?: boolean;
}

function isValidRating10(value: unknown): value is number | null {
  if (value === null || value === undefined) return true;
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10;
}

function isMissingSchemaError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: string }).code ?? '';
  const message = (error as { message?: string }).message ?? '';
  return (
    code === '42P01' ||
    code === '42703' ||
    code === '42883' ||
    code === 'PGRST202' ||
    /relation .* does not exist/i.test(message) ||
    /column .* does not exist/i.test(message) ||
    /function .* does not exist/i.test(message) ||
    /could not find .*function/i.test(message)
  );
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
    ['coffee_quality_rating', body.coffee_quality_rating ?? null],
    ['coffee_art_rating', body.coffee_art_rating ?? null],
    ['coffee_mug_rating', body.coffee_mug_rating ?? null],
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
  if (pErr) {
    if (isMissingSchemaError(pErr)) {
      return NextResponse.json({ error: 'table missing' }, { status: 503 });
    }
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }
  if (!place) return NextResponse.json({ error: 'place not found' }, { status: 404 });

  const isNearPlace = isWithin(
    { lat: body.verified_lat, lng: body.verified_lng },
    { lat: place.lat, lng: place.lng },
  );
  if (!isNearPlace) {
    return NextResponse.json(
      { error: `too far from the place (must be within ${GEO_VERIFY_METERS}m)` },
      { status: 400 },
    );
  }

  const reviewPayload = {
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
    geo_verified: false,
    verified_lat: null,
    verified_lng: null,
    coffee_quality_rating: body.coffee_quality_rating ?? null,
    coffee_art_rating: body.coffee_art_rating ?? null,
    coffee_mug_rating: body.coffee_mug_rating ?? null,
    coffee_no_art: body.coffee_no_art ?? false,
    coffee_no_mug: body.coffee_no_mug ?? false,
  };

  if (!isDemo) {
    const { data, error } = await db.rpc('submit_review_rate_limited', {
      p_place_id: reviewPayload.place_id,
      p_overall_rating: reviewPayload.overall_rating,
      p_overall_suggested: reviewPayload.overall_suggested,
      p_overall_user_set: reviewPayload.overall_user_set,
      p_wifi_rating: reviewPayload.wifi_rating,
      p_noise_rating: reviewPayload.noise_rating,
      p_seating_rating: reviewPayload.seating_rating,
      p_outlets_rating: reviewPayload.outlets_rating,
      p_food_rating: reviewPayload.food_rating,
      p_food_value_rating: reviewPayload.food_value_rating,
      p_current_busyness: reviewPayload.current_busyness,
      p_temperature_feel: reviewPayload.temperature_feel,
      p_drink_price_range: reviewPayload.drink_price_range,
      p_food_price_range: reviewPayload.food_price_range,
      p_ate_food: reviewPayload.ate_food,
      p_environment_facts: reviewPayload.environment_facts,
      p_work_facts: reviewPayload.work_facts,
      p_place_type: reviewPayload.place_type,
      p_current_seating: reviewPayload.current_seating,
      p_outside_temp_c: reviewPayload.outside_temp_c,
      p_outside_condition: reviewPayload.outside_condition,
      p_comment: reviewPayload.comment,
      p_coffee_quality_rating: reviewPayload.coffee_quality_rating,
      p_coffee_art_rating: reviewPayload.coffee_art_rating,
      p_coffee_mug_rating: reviewPayload.coffee_mug_rating,
      p_coffee_no_art: reviewPayload.coffee_no_art,
      p_coffee_no_mug: reviewPayload.coffee_no_mug,
    });

    if (error) {
      const message = (error as { message?: string }).message ?? '';
      if (isMissingSchemaError(error)) {
        return NextResponse.json({ error: 'table missing' }, { status: 503 });
      }
      if (/daily review limit reached/i.test(message)) {
        return NextResponse.json({ error: 'daily review limit reached' }, { status: 429 });
      }
      return NextResponse.json({ error: message || 'insert failed' }, { status: 500 });
    }

    const inserted = Array.isArray(data) ? data[0] : data;
    if (!inserted?.inserted) {
      return NextResponse.json({ error: 'daily review limit reached' }, { status: 429 });
    }

    return NextResponse.json({ id: inserted.id });
  }

  const { data, error } = await insertWithDemoFlag(db, 'reviews', reviewPayload, isDemo);

  if (error) {
    const message = (error as { message?: string }).message ?? '';
    // Demo-mode contract: missing table or columns → soft 503 so the form
    // shows the success state and the demo surface keeps working.
    if (isMissingSchemaError(error)) {
      return NextResponse.json({ error: 'table missing' }, { status: 503 });
    }
    return NextResponse.json({ error: message || 'insert failed' }, { status: 500 });
  }
  return NextResponse.json({ id: data?.id });
}
