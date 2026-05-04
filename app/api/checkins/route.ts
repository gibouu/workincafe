import { NextResponse, type NextRequest } from 'next/server';
import {
  getRequestActor,
  insertWithDemoFlag,
  resolvePlaceIdForActor,
} from '@/lib/auth/request-actor';
import { isWithin } from '@/app/api/_shared/geo-check';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const { db, user, isDemo } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  // 10/min per user — check-ins are quick taps with bursts allowed.
  const rl = rateLimit('checkins', user.id, { capacity: 10, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'too many check-ins — slow down' },
      { status: 429, headers: { 'retry-after': String(rl.retryAfterSec) } },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    place_id?: string;
    lat?: number;
    lng?: number;
    studying_until?: string;
  } | null;
  if (!body?.place_id || typeof body.lat !== 'number' || typeof body.lng !== 'number') {
    return NextResponse.json({ error: 'place_id, lat, lng required' }, { status: 400 });
  }

  const placeId = await resolvePlaceIdForActor(db, body.place_id, isDemo);

  const { data: place, error: pErr } = await db
    .from('places')
    .select('lat, lng')
    .eq('id', placeId)
    .maybeSingle();
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!place) return NextResponse.json({ error: 'place not found' }, { status: 404 });

  const verified = isWithin(
    { lat: body.lat, lng: body.lng },
    { lat: place.lat, lng: place.lng },
  );

  const { data, error } = await insertWithDemoFlag(
    db,
    'checkins',
    {
      place_id: placeId,
      user_id: user.id,
      lat: body.lat,
      lng: body.lng,
      verified,
      studying_until: body.studying_until ?? null,
    },
    isDemo,
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id, verified });
}
