import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';
import { isEmailAllowlisted } from '@/lib/auth/admin-allowlist';
import { createAdminClient } from '@/lib/supabase/admin';

interface Body {
  decision?: 'approved' | 'rejected';
  rejection_reason?: string;
}

const PARIS_BBOX = { minLat: 48.815, maxLat: 48.902, minLng: 2.224, maxLng: 2.470 };
const TORONTO_BBOX = { minLat: 43.58, maxLat: 43.86, minLng: -79.64, maxLng: -79.12 };

function cityForCoords(lat: number, lng: number): 'paris' | 'toronto' | null {
  if (
    lat >= PARIS_BBOX.minLat &&
    lat <= PARIS_BBOX.maxLat &&
    lng >= PARIS_BBOX.minLng &&
    lng <= PARIS_BBOX.maxLng
  ) {
    return 'paris';
  }
  if (
    lat >= TORONTO_BBOX.minLat &&
    lat <= TORONTO_BBOX.maxLat &&
    lng >= TORONTO_BBOX.minLng &&
    lng <= TORONTO_BBOX.maxLng
  ) {
    return 'toronto';
  }
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { db, user } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isEmailAllowlisted(user.email)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { data: me } = await db.from('users').select('is_admin').eq('id', user.id).maybeSingle();
  if (!me?.is_admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id: requestId } = await params;
  const body = (await request.json().catch(() => null)) as Body | null;
  if (body?.decision !== 'approved' && body?.decision !== 'rejected') {
    return NextResponse.json({ error: "decision must be 'approved' or 'rejected'" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: req, error: reqErr } = await admin
    .from('place_requests')
    .select('id, name, lat, lng, address, category_suggestion, notes, status')
    .eq('id', requestId)
    .maybeSingle();
  if (reqErr) return NextResponse.json({ error: reqErr.message }, { status: 500 });
  if (!req) return NextResponse.json({ error: 'request not found' }, { status: 404 });
  if (req.status !== 'pending') {
    return NextResponse.json({ error: 'request already decided' }, { status: 409 });
  }

  if (body.decision === 'approved') {
    const city = cityForCoords(req.lat, req.lng);
    // Insert the new place. category_suggestion may be 'other' or unset; fall
    // back to 'other' so the row is valid even if the submitter skipped it.
    const { error: placeErr } = await admin.from('places').insert({
      name: req.name,
      address: req.address ?? null,
      city: city ?? null,
      lat: req.lat,
      lng: req.lng,
      category: req.category_suggestion ?? 'other',
    });
    if (placeErr) return NextResponse.json({ error: placeErr.message }, { status: 500 });
  }

  const { error: updErr } = await admin
    .from('place_requests')
    .update({
      status: body.decision,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason:
        body.decision === 'rejected' ? body.rejection_reason?.trim() || null : null,
    })
    .eq('id', requestId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
