import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isWithin } from '@/app/api/_shared/geo-check';

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
    studying_until?: string;
  } | null;
  if (!body?.place_id || typeof body.lat !== 'number' || typeof body.lng !== 'number') {
    return NextResponse.json({ error: 'place_id, lat, lng required' }, { status: 400 });
  }

  const { data: place, error: pErr } = await supabase
    .from('places')
    .select('lat, lng')
    .eq('id', body.place_id)
    .maybeSingle();
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!place) return NextResponse.json({ error: 'place not found' }, { status: 404 });

  const verified = isWithin(
    { lat: body.lat, lng: body.lng },
    { lat: place.lat, lng: place.lng },
  );

  const { data, error } = await supabase
    .from('checkins')
    .insert({
      place_id: body.place_id,
      user_id: user.id,
      lat: body.lat,
      lng: body.lng,
      verified,
      studying_until: body.studying_until ?? null,
    })
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id, verified });
}
