import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';
import { isEmailAllowlisted } from '@/lib/auth/admin-allowlist';
import { createAdminClient } from '@/lib/supabase/admin';
import { applyFlaggedReviewDecision } from '@/lib/admin/decide-flagged-review';

/**
 * Bulk dismiss / hide flagged reviews (#167). Same per-row logic as the
 * single decision route, capped at 50 ids. **'ban' is intentionally not
 * bulk-able** — banning authors is high-impact and must stay a deliberate
 * per-row action.
 *
 * POST /api/admin/flagged-reviews/bulk
 *   { ids: string[], decision: 'dismiss'|'hide', reason?: string }
 */

const MAX_BATCH = 50;

interface Body {
  ids?: unknown;
  decision?: 'dismiss' | 'hide' | 'ban';
  reason?: string;
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
  if (body?.decision !== 'dismiss' && body?.decision !== 'hide') {
    return NextResponse.json(
      { error: "decision must be 'dismiss' or 'hide' (ban is not bulk-able)" },
      { status: 400 },
    );
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
    const r = await applyFlaggedReviewDecision(admin, id, body.decision, body.reason, user.id);
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
