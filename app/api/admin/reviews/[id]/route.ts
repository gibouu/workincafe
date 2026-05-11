import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';
import { isEmailAllowlisted } from '@/lib/auth/admin-allowlist';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Per-review admin actions. See #136.
 *
 * PATCH /api/admin/reviews/[id]
 *   Body: { is_hidden?: boolean }
 *   Hide / restore a review without deleting. Hidden rows stay in the
 *   table but are excluded from public reads via RLS / view filters.
 *
 * DELETE /api/admin/reviews/[id]
 *   Hard delete. Use sparingly — review history is the platform's
 *   primary content. Prefer hide for moderation; delete only when the
 *   content itself is illegal / leaks PII.
 */

async function requireAdmin(request: NextRequest) {
  const { db, user } = await getRequestActor(request);
  if (!user) return { error: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) };
  if (!isEmailAllowlisted(user.email)) {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }
  const { data: me } = await db.from('users').select('is_admin').eq('id', user.id).maybeSingle();
  if (!me?.is_admin) return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  return { user };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin(request);
  if (gate.error) return gate.error;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { is_hidden?: boolean } | null;
  if (!body || typeof body.is_hidden !== 'boolean') {
    return NextResponse.json({ error: 'is_hidden (boolean) required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('reviews')
    .update({ is_hidden: body.is_hidden })
    .eq('id', id)
    .select('id, is_hidden')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ review: data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin(request);
  if (gate.error) return gate.error;

  const { id } = await params;
  const admin = createAdminClient();
  const { error, count } = await admin
    .from('reviews')
    .delete({ count: 'exact' })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if ((count ?? 0) === 0) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
