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

interface DecidedClaim {
  id: string;
  place_id: string;
  claimant_user_id: string;
  claimant_email: string | null;
  status: 'approved' | 'rejected';
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

  const { data, error: decisionErr } = await admin.rpc('decide_place_claim', {
    p_claim_id: claimId,
    p_decision: body.decision,
    p_reviewer_id: user.id,
    p_rejection_reason: body.decision === 'rejected' ? body.rejection_reason ?? null : null,
  });
  if (decisionErr) {
    const message = decisionErr.message ?? 'claim decision failed';
    if (/already decided/i.test(message)) {
      return NextResponse.json({ error: 'claim already decided' }, { status: 409 });
    }
    if (/not found/i.test(message)) {
      return NextResponse.json({ error: 'claim not found' }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const claim = (Array.isArray(data) ? data[0] : data) as DecidedClaim | null;
  if (!claim) return NextResponse.json({ error: 'claim not found' }, { status: 404 });

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
    try {
      await sendEmail({ to: claim.claimant_email, ...message });
    } catch (error) {
      console.error('claim decision email failed', error);
    }
  }

  return NextResponse.json({ ok: true });
}
