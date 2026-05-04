import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor, insertWithDemoFlag } from '@/lib/auth/request-actor';
import { rateLimit } from '@/lib/rate-limit';

const PARIS_BBOX = { minLat: 48.815, maxLat: 48.902, minLng: 2.224, maxLng: 2.470 };
const TORONTO_BBOX = { minLat: 43.58, maxLat: 43.86, minLng: -79.64, maxLng: -79.12 };

function inCity(lat: number, lng: number) {
  return (
    (lat >= PARIS_BBOX.minLat &&
      lat <= PARIS_BBOX.maxLat &&
      lng >= PARIS_BBOX.minLng &&
      lng <= PARIS_BBOX.maxLng) ||
    (lat >= TORONTO_BBOX.minLat &&
      lat <= TORONTO_BBOX.maxLat &&
      lng >= TORONTO_BBOX.minLng &&
      lng <= TORONTO_BBOX.maxLng)
  );
}

export async function POST(request: NextRequest) {
  const { db, user, isDemo } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  // 10/hour per user — opening one drawer per place.
  const rl = rateLimit('places-request', user.id, { capacity: 10, windowMs: 60 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'too many submissions — try again later' },
      { status: 429, headers: { 'retry-after': String(rl.retryAfterSec) } },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    name?: string;
    lat?: number;
    lng?: number;
    category?: string;
    address?: string;
    notes?: string;
  } | null;

  if (!body?.name || typeof body.lat !== 'number' || typeof body.lng !== 'number') {
    return NextResponse.json({ error: 'name, lat, lng required' }, { status: 400 });
  }
  if (!inCity(body.lat, body.lng)) {
    return NextResponse.json(
      { error: 'lat/lng is outside supported cities (Paris / Toronto)' },
      { status: 400 },
    );
  }

  const { data, error } = await insertWithDemoFlag(
    db,
    'place_requests',
    {
      submitted_by: user.id,
      name: body.name.trim(),
      lat: body.lat,
      lng: body.lng,
      address: body.address?.trim() || null,
      category_suggestion: (body.category as never) ?? null,
      notes: body.notes?.trim() || null,
    },
    isDemo,
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id });
}
