import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor, isOwnerOf } from '@/lib/auth/request-actor';
import { awardPointForUse } from '@/lib/loyalty/points';

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

  // Atomic decrement — guards against double-scan races
  const { data: updated, error: uErr } = await db
    .from('deal_purchases')
    .update({ uses_remaining: ticket.uses_remaining - 1 })
    .eq('id', ticket.id)
    .gt('uses_remaining', 0)
    .select('uses_remaining, uses_total')
    .maybeSingle();
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
  if (!updated) {
    return NextResponse.json({ error: 'no uses remaining' }, { status: 410 });
  }

  // Insert the use record
  const { data: useRow, error: useErr } = await db
    .from('deal_uses')
    .insert({
      purchase_id: ticket.id,
      scanned_by: user.id,
      notes: body?.notes?.slice(0, 200) ?? null,
      ...(isDemo ? { is_demo: true } : {}),
    })
    .select('id')
    .maybeSingle();
  if (useErr) {
    // Best-effort rollback (uses_remaining was already decremented)
    await db
      .from('deal_purchases')
      .update({ uses_remaining: updated.uses_remaining + 1 })
      .eq('id', ticket.id);
    return NextResponse.json({ error: useErr.message }, { status: 500 });
  }

  // Award point — server-issued only
  await awardPointForUse(db, {
    user_id: ticket.user_id,
    use_id: useRow!.id,
    purchase_id: ticket.id,
    place_id: ticket.place_id,
    deal_id: ticket.deal_id,
    is_demo: isDemo,
  }).catch(() => null); // tolerable miss; admin can backfill

  return NextResponse.json({
    ok: true,
    uses_remaining: updated.uses_remaining,
    uses_total: updated.uses_total,
    deal_title: (ticket as unknown as { deals: { title: string } | null }).deals?.title ?? 'Deal',
  });
}
