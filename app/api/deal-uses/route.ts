import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor, isOwnerOf } from '@/lib/auth/request-actor';
import { createAdminClient } from '@/lib/supabase/admin';

interface Body {
  qr_code?: string;
  notes?: string;
}

export async function POST(request: NextRequest) {
  const { db, user, isDemo } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Body | null;
  const code = body?.qr_code?.trim().toUpperCase().replace(/[\s-]/g, '');
  if (!code) return NextResponse.json({ error: 'qr_code required' }, { status: 400 });

  // Look up the ticket
  const { data: ticket, error: tErr } = await db
    .from('deal_purchases')
    .select(
      'id, deal_id, place_id, user_id, uses_remaining, uses_total, expires_at, deals(title)',
    )
    .eq('qr_code', code)
    .maybeSingle();
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
  if (!ticket) return NextResponse.json({ error: 'invalid code' }, { status: 404 });

  // Ownership check
  const owns = await isOwnerOf(db, ticket.place_id, user.id);
  if (!owns) return NextResponse.json({ error: 'this code is for a different place' }, { status: 403 });

  // Expiry
  if (ticket.expires_at && new Date(ticket.expires_at) < new Date()) {
    return NextResponse.json({ error: 'code expired' }, { status: 410 });
  }

  const admin = createAdminClient();

  const notes = body?.notes?.slice(0, 200) ?? null;
  const { data: redemptionRows, error: redeemErr } = await admin.rpc(
    'redeem_deal_purchase',
    {
      p_purchase_id: ticket.id,
      p_scanned_by: user.id,
      p_notes: notes,
      p_is_demo: isDemo,
    },
  );
  if (redeemErr) {
    if (/no uses remaining/i.test(redeemErr.message ?? '')) {
      return NextResponse.json({ error: 'no uses remaining' }, { status: 410 });
    }
    return NextResponse.json({ error: redeemErr.message }, { status: 500 });
  }
  const redemption = Array.isArray(redemptionRows)
    ? redemptionRows[0]
    : redemptionRows;
  if (!redemption) {
    return NextResponse.json({ error: 'no uses remaining' }, { status: 410 });
  }

  return NextResponse.json({
    ok: true,
    uses_remaining: redemption.uses_remaining,
    uses_total: redemption.uses_total,
    deal_title: (ticket as unknown as { deals: { title: string } | null }).deals?.title ?? 'Deal',
  });
}
