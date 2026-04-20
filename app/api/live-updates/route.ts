import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isWithin } from '@/app/api/_shared/geo-check';
import type { NoiseLevel, SeatingAvailability, TemperatureLevel } from '@/types/database';

const NOISE: NoiseLevel[] = ['quiet', 'moderate', 'loud'];
const SEATING: SeatingAvailability[] = ['plenty', 'some', 'full'];
const TEMP: TemperatureLevel[] = ['cold', 'comfortable', 'warm', 'hot'];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    place_id?: string;
    lat?: number;
    lng?: number;
    noise_level?: string;
    seating_availability?: string;
    temperature?: string;
  } | null;
  if (!body?.place_id) return NextResponse.json({ error: 'place_id required' }, { status: 400 });

  const { data: place, error: pErr } = await supabase
    .from('places')
    .select('lat, lng')
    .eq('id', body.place_id)
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

  const { data, error } = await supabase
    .from('live_updates')
    .insert({
      place_id: body.place_id,
      user_id: user.id,
      noise_level: pickEnum(body.noise_level, NOISE),
      seating_availability: pickEnum(body.seating_availability, SEATING),
      temperature: pickEnum(body.temperature, TEMP),
    })
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id });
}
