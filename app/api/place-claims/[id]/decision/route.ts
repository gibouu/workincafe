import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';
import { isEmailAllowlisted } from '@/lib/auth/admin-allowlist';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/send';
import {
  claimApprovedEmail,
  claimRejectedEmail,
} from '@/lib/email/templates/claim-decision';

interface Body {
  decision?: 'approved' | 'rejected';
  rejection_reason?: string;
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

  // Confirm admin
  const { data: me } = await db.from('users').select('is_admin').eq('id', user.id).maybeSingle();
  if (!me?.is_admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id: claimId } = await params;
  const body = (await request.json().catch(() => null)) as Body | null;
  if (body?.decision !== 'approved' && body?.decision !== 'rejected') {
    return NextResponse.json({ error: "decision must be 'approved' or 'rejected'" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: claim, error: claimErr } = await admin
    .from('place_claims')
    .select('id, place_id, claimant_user_id, claimant_email, status')
    .eq('id', claimId)
    .maybeSingle();
  if (claimErr) return NextResponse.json({ error: claimErr.message }, { status: 500 });
  if (!claim) return NextResponse.json({ error: 'claim not found' }, { status: 404 });
  if (claim.status !== 'pending') {
    return NextResponse.json({ error: 'claim already decided' }, { status: 409 });
  }

  const { error: updErr } = await admin
    .from('place_claims')
    .update({
      status: body.decision,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: body.decision === 'rejected' ? body.rejection_reason ?? null : null,
    })
    .eq('id', claimId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  if (body.decision === 'approved') {
    // Insert place_owners row (idempotent — partial unique on active rows)
    const { error: ownErr } = await admin
      .from('place_owners')
      .insert({
        place_id: claim.place_id,
        user_id: claim.claimant_user_id,
        granted_by: user.id,
      });
    // Tolerate "already an owner" (unique index violation)
    if (ownErr && !/duplicate key|unique/i.test(ownErr.message)) {
      return NextResponse.json({ error: ownErr.message }, { status: 500 });
    }
  }

  // Best-effort email notification — failures don't block the admin response.
  // See #22.
  if (claim.claimant_email) {
    const { data: place } = await admin
      .from('places')
      .select('name')
      .eq('id', claim.place_id)
      .maybeSingle();
    const placeName = place?.name ?? 'your place';
    const message =
      body.decision === 'approved'
        ? claimApprovedEmail({
            to: claim.claimant_email,
            placeName,
            placeId: claim.place_id,
          })
        : claimRejectedEmail({
            to: claim.claimant_email,
            placeName,
            reason: body.rejection_reason ?? null,
          });
    void sendEmail({ to: claim.claimant_email, ...message });
  }

  return NextResponse.json({ ok: true });
}
