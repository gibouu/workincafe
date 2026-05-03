import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor, isOwnerOf } from '@/lib/auth/request-actor';

interface PatchBody {
  title?: string;
  description?: string;
  pack_size?: number;
  price_cents?: number;
  ends_at?: string | null;
  purchase_limit_per_user?: number | null;
  active?: boolean;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { db, user } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { id } = await params;

  const { data: deal } = await db
    .from('deals')
    .select('place_id')
    .eq('id', id)
    .maybeSingle();
  if (!deal) return NextResponse.json({ error: 'deal not found' }, { status: 404 });

  const owns = await isOwnerOf(db, deal.place_id, user.id);
  if (!owns) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body?.title !== undefined) patch.title = body.title.trim().slice(0, 80);
  if (body?.description !== undefined) patch.description = body.description.trim().slice(0, 280);
  if (body?.pack_size !== undefined)
    patch.pack_size = Math.max(1, Math.min(100, Math.floor(body.pack_size)));
  if (body?.price_cents !== undefined) patch.price_cents = Math.max(0, Math.round(body.price_cents));
  if (body?.ends_at !== undefined) patch.ends_at = body.ends_at;
  if (body?.purchase_limit_per_user !== undefined)
    patch.purchase_limit_per_user = body.purchase_limit_per_user;
  if (body?.active !== undefined) patch.active = body.active;

  const { error } = await db.from('deals').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { db, user } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { id } = await params;

  const { data: deal } = await db
    .from('deals')
    .select('place_id')
    .eq('id', id)
    .maybeSingle();
  if (!deal) return NextResponse.json({ error: 'deal not found' }, { status: 404 });

  const owns = await isOwnerOf(db, deal.place_id, user.id);
  if (!owns) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  // Soft-archive: just deactivate so any open tickets remain valid.
  const { error } = await db
    .from('deals')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
