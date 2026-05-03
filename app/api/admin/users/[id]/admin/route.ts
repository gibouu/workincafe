import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';
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

  // Safety: never let the last admin demote themselves out of existence.
  if (!body.promote) {
    const { count } = await admin
      .from('users')
      .select('id', { head: true, count: 'exact' })
      .eq('is_admin', true);
    if ((count ?? 0) <= 1 && targetId === user.id) {
      return NextResponse.json(
        { error: "you're the only admin — promote someone else first" },
        { status: 409 },
      );
    }
  }

  const { error } = await admin
    .from('users')
    .update({ is_admin: body.promote })
    .eq('id', targetId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
