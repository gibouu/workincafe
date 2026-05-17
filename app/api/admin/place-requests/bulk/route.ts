import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';
import { isEmailAllowlisted } from '@/lib/auth/admin-allowlist';
import { createAdminClient } from '@/lib/supabase/admin';
import { applyPlaceRequestDecision } from '@/lib/admin/decide-place-request';

/**
 * Bulk approve / reject place requests (#167). Same per-row logic as the
 * single decision route, capped at 50 ids per call. Processed sequentially
 * — approval does a Photon reverse-geocode + insert; sequential keeps us
 * well under rate limits and makes the result deterministic.
 *
 * POST /api/admin/place-requests/bulk
 *   { ids: string[], decision: 'approved'|'rejected', rejection_reason?: string }
 */

const MAX_BATCH = 50;

interface Body {
  ids?: unknown;
  decision?: 'approved' | 'rejected';
  rejection_reason?: string;
}

export async function POST(request: NextRequest) {
  const { db, user } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isEmailAllowlisted(user.email)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { data: me } = await db.from('users').select('is_admin').eq('id', user.id).maybeSingle();
  if (!me?.is_admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = (await request.json().catch(() => null)) as Body | null;
  if (body?.decision !== 'approved' && body?.decision !== 'rejected') {
    return NextResponse.json({ error: "decision must be 'approved' or 'rejected'" }, { status: 400 });
  }
  const ids = Array.isArray(body.ids)
    ? Array.from(new Set(body.ids.filter((x): x is string => typeof x === 'string' && x.length > 0)))
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 });
  }
  if (ids.length > MAX_BATCH) {
    return NextResponse.json({ error: `at most ${MAX_BATCH} ids per call` }, { status: 400 });
  }

  const admin = createAdminClient();
  const processed: string[] = [];
  const skipped: { id: string; reason: string }[] = [];
  for (const id of ids) {
    const r = await applyPlaceRequestDecision(
      admin,
      id,
      body.decision,
      body.rejection_reason,
      user.id,
    );
    if (r.ok) processed.push(id);
    else skipped.push({ id, reason: r.error });
  }

  return NextResponse.json({
    ok: true,
    decision: body.decision,
    processed,
    skipped,
    processedCount: processed.length,
    skippedCount: skipped.length,
  });
}
