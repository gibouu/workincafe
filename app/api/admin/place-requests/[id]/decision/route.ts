import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';
import { isEmailAllowlisted } from '@/lib/auth/admin-allowlist';
import { createAdminClient } from '@/lib/supabase/admin';
import { SEED_CITIES } from '@/scripts/seed-cities';

interface Body {
  decision?: 'approved' | 'rejected';
  rejection_reason?: string;
}

/**
 * Resolve approved submission coords to (city, country). Fixes #143.
 *
 *   1. Walk SEED_CITIES — first match whose bbox contains the point
 *      returns its label + ISO country.
 *   2. Photon reverse-geocode fallback — for points outside any
 *      seeded city (e.g. Lyon, Hamburg, São Paulo), at least pull
 *      the country code so the per-place currency lookup (#118)
 *      still works.
 *   3. Both null if everything fails. Row is still valid; admin can
 *      edit later via /admin/places (#135).
 */
async function resolveCityCountry(
  lat: number,
  lng: number,
): Promise<{ city: string | null; country: string | null }> {
  // Tier 1: seeded city bbox lookup. Seed bbox is [south, west, north, east].
  for (const c of SEED_CITIES) {
    const [s, w, n, e] = c.bbox;
    if (lat >= s && lat <= n && lng >= w && lng <= e) {
      return { city: c.label, country: c.country };
    }
  }

  // Tier 2: Photon reverse-geocode. Best-effort; soft-fail on transport
  // errors. We only care about countrycode here — city is the property
  // we couldn't trust from a reverse lookup anyway (often returns the
  // nearest hamlet instead of the metro).
  try {
    const url = new URL('https://photon.komoot.io/reverse');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    url.searchParams.set('limit', '1');
    const resp = await fetch(url.toString(), {
      headers: {
        'user-agent': 'workincafe/0.1 (https://workin.cafe; ops@workin.cafe)',
        accept: 'application/json',
      },
      next: { revalidate: 86400 }, // place coords don't move; cache 24h
    });
    if (resp.ok) {
      const data = (await resp.json()) as {
        features?: {
          properties?: {
            countrycode?: string;
            city?: string;
            locality?: string;
            district?: string;
          };
        }[];
      };
      const f = data.features?.[0]?.properties;
      if (f) {
        const country = f.countrycode?.toUpperCase() ?? null;
        const city = f.city ?? f.locality ?? null;
        return { city, country };
      }
    }
  } catch {
    // ignore — soft-fail to nulls
  }

  return { city: null, country: null };
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
    const { city, country } = await resolveCityCountry(req.lat, req.lng);
    // Insert the new place. category_suggestion may be 'other' or unset; fall
    // back to 'other' so the row is valid even if the submitter skipped it.
    const { error: placeErr } = await admin.from('places').insert({
      name: req.name,
      address: req.address ?? null,
      city,
      country,
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
