import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';
import { loyaltyProgressFor } from '@/lib/loyalty/points';

export async function GET(request: NextRequest) {
  const { db, user } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  try {
    const progress = await loyaltyProgressFor(db, user.id);
    return NextResponse.json(progress);
  } catch {
    // Schema not applied yet — soft return zeros so the card renders.
    return NextResponse.json(
      {
        balance: 0,
        distinct_places: 0,
        freebie_unlocked: false,
        points_to_unlock: 20,
        places_to_unlock: 5,
      },
      { status: 200 },
    );
  }
}
