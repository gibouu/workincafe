import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';
import {
  loyaltyProgressFor,
  FREEBIE_POINT_COST,
} from '@/lib/loyalty/points';
import { pickFreebiePlace } from '@/lib/loyalty/freebie';
import { generateRedemptionCode } from '@/lib/loyalty/qr';
import { createAdminClient } from '@/lib/supabase/admin';

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
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('claim_freebie_purchase', {
    p_user_id: user.id,
    p_place_id: pick.id,
    p_qr_code: qrCode,
    p_is_demo: isDemo,
  });

  if (error) {
    const message = error.message ?? 'freebie claim failed';
    const status = /freebie not unlocked/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }

  const purchase = Array.isArray(data) ? data[0] : data;

  return NextResponse.json({
    place: { id: pick.id, name: pick.name },
    qr_code: (purchase as { qr_code: string }).qr_code,
    points_spent: FREEBIE_POINT_COST,
  });
}
