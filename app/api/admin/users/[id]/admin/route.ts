import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';
import { isEmailAllowlisted } from '@/lib/auth/admin-allowlist';
import { createAdminClient } from '@/lib/supabase/admin';

interface Body {
  promote?: boolean;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { db, user } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isEmailAllowlisted(user.email)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { data: me } = await db
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (!me?.is_admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id: targetId } = await params;
  const body = (await request.json().catch(() => null)) as Body | null;
  if (typeof body?.promote !== 'boolean') {
    return NextResponse.json({ error: 'promote (boolean) required' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error } = await admin.rpc('set_user_admin_status', {
    p_target_id: targetId,
    p_promote: body.promote,
    p_actor_id: user.id,
  });
  if (error) {
    const message = error.message ?? 'admin status update failed';
    if (/only admin|last admin|promote someone else/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    if (/user not found/i.test(message)) {
      return NextResponse.json({ error: 'user not found' }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
