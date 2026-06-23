import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor, insertWithDemoFlag } from '@/lib/auth/request-actor';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Add-a-place v2 (#200): submissions are accepted from ANY city — the
 * six-city seed scope bounds scraping, not user growth.
 *
 * Client-supplied location is not an authorization signal. All ordinary
 * submissions enter the pending queue, where an admin approves before the
 * place is created.
 */

interface Body {
  name?: string;
  lat?: number;
  lng?: number;
  category?: string;
  address?: string;
  notes?: string;
  verified_lat?: number;
  verified_lng?: number;
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

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.name || typeof body.lat !== 'number' || typeof body.lng !== 'number') {
    return NextResponse.json({ error: 'name, lat, lng required' }, { status: 400 });
  }

  const name = body.name.trim();
  const address = body.address?.trim() || null;
  const notes = body.notes?.trim() || null;
  const category = (body.category as string | undefined) ?? null;

  const { data, error } = await insertWithDemoFlag(
    db,
    'place_requests',
    {
      submitted_by: user.id,
      name,
      lat: body.lat,
      lng: body.lng,
      address,
      category_suggestion: (category as never) ?? null,
      notes,
    },
    isDemo,
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ published: false, id: data?.id });
}
