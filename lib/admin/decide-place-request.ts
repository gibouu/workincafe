// Shared place-request decision logic (#167). Used by the single-row
// decision route and the bulk endpoint so the two can never drift —
// approval inserts a place with resolved city/country, rejection records
// the reason; both stamp reviewer + timestamp.
import type { createAdminClient } from '@/lib/supabase/admin';
import { SEED_CITIES } from '@/scripts/seed-cities';

type AdminClient = ReturnType<typeof createAdminClient>;

export type Decision = 'approved' | 'rejected';

/**
 * Resolve approved submission coords to (city, country). Fixes #143.
 *   1. Walk SEED_CITIES — first bbox that contains the point wins.
 *   2. Photon reverse-geocode fallback — country code only.
 *   3. Both null if everything fails (row still valid; editable later).
 */
export async function resolveCityCountry(
  lat: number,
  lng: number,
): Promise<{ city: string | null; country: string | null }> {
  for (const c of SEED_CITIES) {
    const [s, w, n, e] = c.bbox;
    if (lat >= s && lat <= n && lng >= w && lng <= e) {
      return { city: c.label, country: c.country };
    }
  }
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
      next: { revalidate: 86400 },
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
        return {
          country: f.countrycode?.toUpperCase() ?? null,
          city: f.city ?? f.locality ?? null,
        };
      }
    }
  } catch {
    // ignore — soft-fail to nulls
  }
  return { city: null, country: null };
}

export type DecisionResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * Apply a decision to one pending place_request. Idempotent-safe: a row
 * that is no longer pending yields a 409 rather than double-inserting.
 */
export async function applyPlaceRequestDecision(
  admin: AdminClient,
  requestId: string,
  decision: Decision,
  rejectionReason: string | undefined,
  reviewerId: string,
): Promise<DecisionResult> {
  const { data: req, error: reqErr } = await admin
    .from('place_requests')
    .select('id, name, lat, lng, address, category_suggestion, notes, status')
    .eq('id', requestId)
    .maybeSingle();
  if (reqErr) return { ok: false, status: 500, error: reqErr.message };
  if (!req) return { ok: false, status: 404, error: 'request not found' };
  if (req.status !== 'pending') {
    return { ok: false, status: 409, error: 'request already decided' };
  }

  if (decision === 'approved') {
    const { city, country } = await resolveCityCountry(req.lat, req.lng);
    const { error: placeErr } = await admin.from('places').insert({
      name: req.name,
      address: req.address ?? null,
      city,
      country,
      lat: req.lat,
      lng: req.lng,
      category: req.category_suggestion ?? 'other',
    });
    if (placeErr) return { ok: false, status: 500, error: placeErr.message };
  }

  const { error: updErr } = await admin
    .from('place_requests')
    .update({
      status: decision,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: decision === 'rejected' ? rejectionReason?.trim() || null : null,
    })
    .eq('id', requestId);
  if (updErr) return { ok: false, status: 500, error: updErr.message };

  return { ok: true };
}
