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
    download_mbps?: number;
    upload_mbps?: number;
    ping_ms?: number;
    connection_type?: string;
  } | null;
  if (!body?.place_id) return NextResponse.json({ error: 'place_id required' }, { status: 400 });

  const { data: place, error: pErr } = await supabase
    .from('places')
    .select('lat, lng')
    .eq('id', body.place_id)
    .maybeSingle();
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!place) return NextResponse.json({ error: 'place not found' }, { status: 404 });

  let geoVerified = false;
  if (typeof body.lat === 'number' && typeof body.lng === 'number') {
    geoVerified = isWithin(
      { lat: body.lat, lng: body.lng },
      { lat: place.lat, lng: place.lng },
    );
  }

  // Rate limit: 1 per place per user per hour
  const hourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
  const { count } = await supabase
    .from('wifi_tests')
    .select('id', { head: true, count: 'exact' })
    .eq('user_id', user.id)
    .eq('place_id', body.place_id)
    .gte('created_at', hourAgo);
  if ((count ?? 0) >= 1) {
    return NextResponse.json({ error: 'one Wi-Fi test per place per hour' }, { status: 429 });
  }

  const { data, error } = await supabase
    .from('wifi_tests')
    .insert({
      place_id: body.place_id,
      user_id: user.id,
      download_mbps: body.download_mbps ?? null,
      upload_mbps: body.upload_mbps ?? null,
      ping_ms: body.ping_ms ?? null,
      connection_type: body.connection_type ?? null,
      geo_verified: geoVerified,
    })
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id, geo_verified: geoVerified });
}
