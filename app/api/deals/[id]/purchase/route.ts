import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';
import { generateRedemptionCode } from '@/lib/loyalty/qr';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Mock purchase endpoint. Schema is ready for real Stripe / Square; this
 * route writes payment_method='demo' and skips the processor. Future PR
 * adds a Stripe Checkout Session before this insert.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { db, user, isDemo } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { id: dealId } = await params;

  const { data: deal, error: dealErr } = await db
    .from('deals')
    .select('id, place_id, kind, pack_size, price_cents, currency, active, starts_at, ends_at, purchase_limit_per_user')
    .eq('id', dealId)
    .maybeSingle();
  if (dealErr) return NextResponse.json({ error: dealErr.message }, { status: 500 });
  if (!deal) return NextResponse.json({ error: 'deal not found' }, { status: 404 });
  if (!deal.active) return NextResponse.json({ error: 'deal not active' }, { status: 409 });
  if (deal.starts_at && new Date(deal.starts_at) > new Date()) {
    return NextResponse.json({ error: 'deal not started' }, { status: 409 });
  }
  if (deal.ends_at && new Date(deal.ends_at) < new Date()) {
    return NextResponse.json({ error: 'deal expired' }, { status: 409 });
  }

  // Per-user purchase limit
  if (deal.purchase_limit_per_user) {
    const { count } = await db
      .from('deal_purchases')
      .select('id', { head: true, count: 'exact' })
      .eq('deal_id', dealId)
      .eq('user_id', user.id);
    if ((count ?? 0) >= deal.purchase_limit_per_user) {
      return NextResponse.json(
        { error: 'purchase limit reached for this deal' },
        { status: 429 },
      );
    }
  }

  const qrCode = generateRedemptionCode();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('deal_purchases')
    .insert({
      deal_id: deal.id,
      place_id: deal.place_id,
      user_id: user.id,
      qr_code: qrCode,
      uses_total: deal.pack_size,
      uses_remaining: deal.pack_size,
      amount_paid_cents: deal.price_cents,
      currency: deal.currency,
      payment_method: 'demo',
      ...(isDemo ? { is_demo: true } : {}),
    })
    .select('id, qr_code, uses_total, uses_remaining, amount_paid_cents, currency')
    .maybeSingle();

  if (error) {
    const code = (error as { code?: string }).code ?? '';
    const message = (error as { message?: string }).message ?? '';
    if (code === '42P01' || /relation .* does not exist/i.test(message)) {
      return NextResponse.json({ error: 'table missing' }, { status: 503 });
    }
    return NextResponse.json({ error: message || 'insert failed' }, { status: 500 });
  }
  return NextResponse.json(data);
}
