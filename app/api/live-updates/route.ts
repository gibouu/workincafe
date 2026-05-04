import { NextResponse, type NextRequest } from 'next/server';
import {
  getRequestActor,
  insertWithDemoFlag,
  resolvePlaceIdForActor,
} from '@/lib/auth/request-actor';
import { isWithin } from '@/app/api/_shared/geo-check';
import { rateLimit } from '@/lib/rate-limit';
import type { NoiseLevel, SeatingAvailability, TemperatureLevel } from '@/types/database';

const NOISE: NoiseLevel[] = ['quiet', 'moderate', 'loud'];
const SEATING: SeatingAvailability[] = ['plenty', 'some', 'full'];
const TEMP: TemperatureLevel[] = ['cold', 'comfortable', 'warm', 'hot'];

export async function POST(request: NextRequest) {
  const { db, user, isDemo } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  // 10/min per user — live updates are quick taps, allow some burst.
  const rl = rateLimit('live-updates', user.id, { capacity: 10, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'too many updates — slow down' },
      { status: 429, headers: { 'retry-after': String(rl.retryAfterSec) } },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    place_id?: string;
    lat?: number;
    lng?: number;
    noise_level?: string;
    seating_availability?: string;
    temperature?: string;
  } | null;
  if (!body?.place_id) return NextResponse.json({ error: 'place_id required' }, { status: 400 });

  const placeId = await resolvePlaceIdForActor(db, body.place_id, isDemo);

  const { data: place, error: pErr } = await db
    .from('places')
    .select('lat, lng')
    .eq('id', placeId)
    .maybeSingle();
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!place) return NextResponse.json({ error: 'place not found' }, { status: 404 });

  if (typeof body.lat === 'number' && typeof body.lng === 'number') {
    if (!isWithin({ lat: body.lat, lng: body.lng }, { lat: place.lat, lng: place.lng })) {
      return NextResponse.json({ error: 'too far from the place' }, { status: 400 });
    }
  }

  const pickEnum = <T extends string>(v: string | undefined, allowed: T[]): T | null =>
    v && (allowed as string[]).includes(v) ? (v as T) : null;

  const { data, error } = await insertWithDemoFlag(
    db,
    'live_updates',
    {
      place_id: placeId,
      user_id: user.id,
      noise_level: pickEnum(body.noise_level, NOISE),
      seating_availability: pickEnum(body.seating_availability, SEATING),
      temperature: pickEnum(body.temperature, TEMP),
    },
    isDemo,
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id });
}
