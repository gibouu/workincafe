import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';
import { loyaltyProgressFor } from '@/lib/loyalty/points';

function zeroProgress() {
  return {
    balance: 0,
    distinct_places: 0,
    freebie_unlocked: false,
    points_to_unlock: 20,
    places_to_unlock: 5,
  };
}

function isMissingLoyaltySchema(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as { code?: string; message?: string };
  const message = maybe.message ?? '';
  return (
    maybe.code === '42P01' ||
    maybe.code === '42883' ||
    maybe.code === 'PGRST202' ||
    maybe.code === 'PGRST205' ||
    /relation .* does not exist/i.test(message) ||
    /could not find the function/i.test(message) ||
    /schema cache/i.test(message)
  );
}

export async function GET(request: NextRequest) {
  const { db, user } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  try {
    const progress = await loyaltyProgressFor(db, user.id);
    return NextResponse.json(progress);
  } catch (err) {
    if (isMissingLoyaltySchema(err)) {
      // Schema not applied yet — soft return zeros so the card renders.
      return NextResponse.json(zeroProgress(), { status: 200 });
    }
    console.error('loyalty lookup failed', err);
    return NextResponse.json({ error: 'loyalty lookup failed' }, { status: 500 });
  }
}
