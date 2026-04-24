import { NextResponse, type NextRequest } from 'next/server';
import {
  getRequestActor,
  resolvePlaceIdForActor,
  upsertWithDemoFlag,
} from '@/lib/auth/request-actor';

export async function GET(request: NextRequest) {
  const { db, user } = await getRequestActor(request);
  if (!user) return NextResponse.json({ favorites: [] });

  const { data, error } = await db
    .from('favorites')
    .select('place_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ favorites: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { db, user, isDemo } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { place_id?: string } | null;
  if (!body?.place_id) return NextResponse.json({ error: 'place_id required' }, { status: 400 });
  const placeId = await resolvePlaceIdForActor(db, body.place_id, isDemo);

  const { error } = await upsertWithDemoFlag(
    db,
    'favorites',
    { user_id: user.id, place_id: placeId },
    { onConflict: 'user_id,place_id' },
    isDemo,
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { db, user } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get('place_id');
  if (!placeId) return NextResponse.json({ error: 'place_id required' }, { status: 400 });

  const { error } = await db
    .from('favorites')
    .delete()
    .eq('user_id', user.id)
    .eq('place_id', placeId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
