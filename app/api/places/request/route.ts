import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor, insertWithDemoFlag } from '@/lib/auth/request-actor';
import { isWithin } from '@/app/api/_shared/geo-check';
import { resolveCityCountry } from '@/lib/admin/decide-place-request';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizedNameHash } from '@/lib/places/normalized-hash';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Add-a-place v2 (#200): submissions are accepted from ANY city — the
 * six-city seed scope bounds scraping, not user growth.
 *
 * Two outcomes:
 *  - Submitter is physically at the place (verified_lat/lng within the
 *    same 150m gate reviews use) → the place publishes INSTANTLY and the
 *    client routes them into the first review. An auto-approved
 *    place_requests row records the submission for the admin activity
 *    feed; admins edit/delete post-hoc via the existing places admin.
 *  - No geolocation or too far away → the legacy pending queue, where an
 *    admin approves before the place is created.
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

  const atThePlace =
    typeof body.verified_lat === 'number' &&
    typeof body.verified_lng === 'number' &&
    isWithin(
      { lat: body.verified_lat, lng: body.verified_lng },
      { lat: body.lat, lng: body.lng },
    );

  if (atThePlace && !isDemo) {
    try {
      const placeId = await publishInstantly(user.id, {
        name,
        lat: body.lat,
        lng: body.lng,
        address,
        category,
        notes,
      });
      return NextResponse.json({ published: true, placeId });
    } catch {
      // Instant path needs the service-role client + live tables; on any
      // failure fall through to the pending queue rather than erroring —
      // same graceful-degradation contract as the rest of the API.
    }
  }

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

interface Submission {
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  category: string | null;
  notes: string | null;
}

async function publishInstantly(userId: string, s: Submission): Promise<string> {
  const admin = createAdminClient();
  const hash = normalizedNameHash(s.name, s.lat, s.lng);
  const { city, country } = await resolveCityCountry(s.lat, s.lng);

  // ignoreDuplicates: an existing place with the same hash wins — the
  // submitter just adds their review to it instead of forking a copy.
  const { data: inserted, error: insErr } = await admin
    .from('places')
    .upsert(
      {
        name: s.name,
        address: s.address,
        city,
        country,
        lat: s.lat,
        lng: s.lng,
        category: s.category ?? 'other',
        normalized_name_hash: hash,
      },
      { onConflict: 'normalized_name_hash', ignoreDuplicates: true },
    )
    .select('id')
    .maybeSingle();
  if (insErr) throw new Error(insErr.message);

  let placeId = inserted?.id as string | undefined;
  if (!placeId) {
    const { data: existing, error: selErr } = await admin
      .from('places')
      .select('id')
      .eq('normalized_name_hash', hash)
      .maybeSingle();
    if (selErr || !existing) throw new Error(selErr?.message ?? 'place lookup failed');
    placeId = existing.id as string;
  }

  // Audit trail: an auto-approved request row keeps every instant publish
  // visible in the admin activity feed (actor = the submitter).
  const { data: audit } = await admin
    .from('place_requests')
    .insert({
      submitted_by: userId,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      address: s.address,
      category_suggestion: (s.category as never) ?? null,
      notes: s.notes,
      status: 'approved',
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })
    .select('id')
    .maybeSingle();

  // Provenance ref; non-fatal if the enum/table predates user_submitted.
  if (audit?.id) {
    await admin
      .from('place_source_refs')
      .upsert(
        {
          place_id: placeId,
          source: 'user_submitted',
          external_id: String(audit.id),
          normalized_name_hash: hash,
        },
        { onConflict: 'source,external_id', ignoreDuplicates: true },
      );
  }

  return placeId;
}
