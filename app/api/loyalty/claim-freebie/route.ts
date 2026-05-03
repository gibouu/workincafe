import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';
import {
  loyaltyProgressFor,
  deductFreebieCost,
  FREEBIE_POINT_COST,
} from '@/lib/loyalty/points';
import { pickFreebiePlace } from '@/lib/loyalty/freebie';
import { generateRedemptionCode } from '@/lib/loyalty/qr';

interface Body {
  near?: { lat: number; lng: number };
}

export async function POST(request: NextRequest) {
  const { db, user, isDemo } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Body | null;
  if (
    !body?.near ||
    typeof body.near.lat !== 'number' ||
    typeof body.near.lng !== 'number'
  ) {
    return NextResponse.json({ error: 'near {lat,lng} required' }, { status: 400 });
  }

  const progress = await loyaltyProgressFor(db, user.id);
  if (!progress.freebie_unlocked) {
    return NextResponse.json(
      {
        error: 'freebie not unlocked',
        balance: progress.balance,
        distinct_places: progress.distinct_places,
      },
      { status: 409 },
    );
  }

  const pick = await pickFreebiePlace(db, { user_id: user.id, near: body.near });
  if (!pick) {
    return NextResponse.json(
      { error: 'no eligible places nearby — try again from a different spot' },
      { status: 404 },
    );
  }

  // Issue a 0-cost ticket. We don't tie this to a real deals row — it's a
  // platform-issued freebie, marked via payment_method='freebie'.
  const qrCode = generateRedemptionCode();
  const { data: purchase, error: pErr } = await db
    .from('deal_purchases')
    .insert({
      deal_id: null,
      place_id: pick.id,
      user_id: user.id,
      qr_code: qrCode,
      uses_total: 1,
      uses_remaining: 1,
      amount_paid_cents: 0,
      currency: 'EUR',
      payment_method: 'freebie',
      ...(isDemo ? { is_demo: true } : {}),
    })
    .select('id, qr_code')
    .maybeSingle();

  if (pErr) {
    // deal_id is NOT NULL in the schema. If your DB rejects null deal_id, we
    // fall back to a different shape — the caller can retry once the schema
    // is updated. For now, return the error to surface it.
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  await deductFreebieCost(db, {
    user_id: user.id,
    place_id: pick.id,
    purchase_id: purchase!.id,
    is_demo: isDemo,
  });

  return NextResponse.json({
    place: { id: pick.id, name: pick.name },
    qr_code: purchase!.qr_code,
    points_spent: FREEBIE_POINT_COST,
  });
}
