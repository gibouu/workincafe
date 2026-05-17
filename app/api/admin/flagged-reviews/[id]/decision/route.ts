import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';
import { isEmailAllowlisted } from '@/lib/auth/admin-allowlist';
import { createAdminClient } from '@/lib/supabase/admin';
import { applyFlaggedReviewDecision } from '@/lib/admin/decide-flagged-review';

interface Body {
  decision?: 'dismiss' | 'hide' | 'ban';
  reason?: string;
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

  const { id: flagId } = await params;
  const body = (await request.json().catch(() => null)) as Body | null;
  const decision = body?.decision;
  if (decision !== 'dismiss' && decision !== 'hide' && decision !== 'ban') {
    return NextResponse.json(
      { error: "decision must be 'dismiss', 'hide', or 'ban'" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const result = await applyFlaggedReviewDecision(admin, flagId, decision, body?.reason, user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, decision });
}
