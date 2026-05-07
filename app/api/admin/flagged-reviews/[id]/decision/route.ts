import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';
import { isEmailAllowlisted } from '@/lib/auth/admin-allowlist';
import { createAdminClient } from '@/lib/supabase/admin';

// `request_status` enum values are limited to ('pending', 'approved',
// 'rejected'). Map admin actions onto that constraint and use the existing
// `resolution` text column to record the specific action taken. See #28.
type Decision = 'dismiss' | 'hide' | 'ban';

interface Body {
  decision?: Decision;
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

  const { data: flag, error: flagErr } = await admin
    .from('flagged_reviews')
    .select('id, review_id, status, reviews(id, user_id)')
    .eq('id', flagId)
    .maybeSingle();
  if (flagErr) return NextResponse.json({ error: flagErr.message }, { status: 500 });
  if (!flag) return NextResponse.json({ error: 'flag not found' }, { status: 404 });
  if (flag.status !== 'pending') {
    return NextResponse.json({ error: 'flag already decided' }, { status: 409 });
  }

  // Supabase's typed select returns `reviews` as the related row; PostgREST
  // sometimes returns it as an array depending on relation cardinality. Both
  // arrive at runtime as a single object here since each flag links one review.
  const review = (Array.isArray(flag.reviews) ? flag.reviews[0] : flag.reviews) as
    | { id: string; user_id: string }
    | null;

  if ((decision === 'hide' || decision === 'ban') && !review) {
    return NextResponse.json({ error: 'underlying review missing' }, { status: 410 });
  }

  // Hide the review row when the action requires it. Doing this before the
  // ban write keeps the user-facing impact (review disappears) immediate even
  // if the user-update step fails for some reason.
  if (decision === 'hide' || decision === 'ban') {
    const { error: revErr } = await admin
      .from('reviews')
      .update({ is_hidden: true })
      .eq('id', review!.id);
    if (revErr) return NextResponse.json({ error: revErr.message }, { status: 500 });
  }

  if (decision === 'ban') {
    const { error: banErr } = await admin
      .from('users')
      .update({ is_banned: true })
      .eq('id', review!.user_id);
    if (banErr) return NextResponse.json({ error: banErr.message }, { status: 500 });
  }

  // Record the moderation outcome on the flag row.
  const status = decision === 'dismiss' ? 'rejected' : 'approved';
  const resolutionParts: string[] = [decision];
  const trimmedReason = body?.reason?.trim();
  if (trimmedReason) resolutionParts.push(trimmedReason);
  const { error: updErr } = await admin
    .from('flagged_reviews')
    .update({
      status,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
      resolution: resolutionParts.join(' · '),
    })
    .eq('id', flagId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, decision });
}
