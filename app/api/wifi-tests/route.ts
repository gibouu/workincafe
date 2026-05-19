import { NextResponse, type NextRequest } from 'next/server';
import {
  getRequestActor,
  insertWithDemoFlag,
  resolvePlaceIdForActor,
} from '@/lib/auth/request-actor';
import { isWithin } from '@/app/api/_shared/geo-check';

export async function POST(request: NextRequest) {
  const { db, user, isDemo } = await getRequestActor(request);
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

  const placeId = await resolvePlaceIdForActor(db, body.place_id, isDemo);

  const { data: place, error: pErr } = await db
    .from('places')
    .select('lat, lng')
    .eq('id', placeId)
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
  const { count, error: rateLimitError } = await db
    .from('wifi_tests')
    .select('id', { head: true, count: 'exact' })
    .eq('user_id', user.id)
    .eq('place_id', placeId)
    .gte('created_at', hourAgo);
  if (rateLimitError) {
    return NextResponse.json({ error: 'unable to verify Wi-Fi test rate limit' }, { status: 500 });
  }
  if ((count ?? 0) >= 1) {
    return NextResponse.json({ error: 'one Wi-Fi test per place per hour' }, { status: 429 });
  }

  if (!isDemo) {
    const { data, error } = await db.rpc('insert_wifi_test_rate_limited', {
      p_place_id: placeId,
      p_download_mbps: body.download_mbps ?? null,
      p_upload_mbps: body.upload_mbps ?? null,
      p_ping_ms: body.ping_ms ?? null,
      p_connection_type: body.connection_type ?? null,
      p_geo_verified: geoVerified,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const inserted = Array.isArray(data) ? data[0] : data;
    if (!inserted?.inserted) {
      return NextResponse.json({ error: 'one Wi-Fi test per place per hour' }, { status: 429 });
    }
    return NextResponse.json({ id: inserted.id, geo_verified: geoVerified });
  }

  const { data, error } = await insertWithDemoFlag(
    db,
    'wifi_tests',
    {
      place_id: placeId,
      user_id: user.id,
      download_mbps: body.download_mbps ?? null,
      upload_mbps: body.upload_mbps ?? null,
      ping_ms: body.ping_ms ?? null,
      connection_type: body.connection_type ?? null,
      geo_verified: geoVerified,
    },
    isDemo,
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id, geo_verified: geoVerified });
}
