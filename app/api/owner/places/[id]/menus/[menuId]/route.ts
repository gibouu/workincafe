import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor, isOwnerOf } from '@/lib/auth/request-actor';
import { createAdminClient } from '@/lib/supabase/admin';

// Owner deletes their own menu. RLS would also enforce ownership but we
// return a clean 403 instead of a silent 0-rows.

interface PatchBody {
  visibility?: 'public' | 'owner_only';
}

// Toggle the visibility flag on a menu. POST replaced; DELETE removes;
// PATCH is the single-field mutation. See #63.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; menuId: string }> },
) {
  const { db, user } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { id: placeId, menuId } = await params;
  const owns = await isOwnerOf(db, placeId, user.id);
  if (!owns) return NextResponse.json({ error: 'not an owner of this place' }, { status: 403 });

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (body?.visibility !== 'public' && body?.visibility !== 'owner_only') {
    return NextResponse.json(
      { error: "visibility must be 'public' or 'owner_only'" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('place_menus')
    .update({ visibility: body.visibility })
    .eq('id', menuId)
    .eq('place_id', placeId);
  if (error) {
    const code = (error as { code?: string }).code ?? '';
    if (code === '42P01' || code === '42703') {
      return NextResponse.json({ ok: true }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, visibility: body.visibility });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; menuId: string }> },
) {
  const { db, user } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { id: placeId, menuId } = await params;
  const owns = await isOwnerOf(db, placeId, user.id);
  if (!owns) return NextResponse.json({ error: 'not an owner of this place' }, { status: 403 });

  const admin = createAdminClient();
  const { error, count } = await admin
    .from('place_menus')
    .delete({ count: 'exact' })
    .eq('id', menuId)
    .eq('place_id', placeId);
  if (error) {
    const code = (error as { code?: string }).code ?? '';
    if (code === '42P01') return NextResponse.json({ ok: true, rows_deleted: 0 }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // Cloudinary asset itself is left behind — pruning is a separate cron
  // (out of scope for #25). The DB row vanishing means the menu stops
  // surfacing in the app immediately.
  return NextResponse.json({ ok: true, rows_deleted: count ?? 0 });
}
