import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';
import { isEmailAllowlisted } from '@/lib/auth/admin-allowlist';
import { createAdminClient } from '@/lib/supabase/admin';

interface Body {
  q?: string;
}

interface AdminUser {
  id: string;
  email: string | null;
  name: string | null;
}

interface PublicUser {
  id: string;
  display_name: string | null;
  is_admin: boolean;
}

interface AuthListResponse {
  users: AdminUser[];
}

export async function POST(request: NextRequest) {
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

  const body = (await request.json().catch(() => null)) as Body | null;
  const q = body?.q?.trim().toLowerCase() ?? '';
  if (q.length < 2) {
    return NextResponse.json({ users: [] });
  }

  const admin = createAdminClient();

  // auth.users is only reachable via the admin (service-role) client.
  // listUsers paginates server-side; we filter client-side because the
  // admin endpoint doesn't accept a query param. 1000 is plenty for our
  // current scale; revisit if user count grows.
  const { data: authResp, error: authErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: 500 });
  }

  const matches = ((authResp as unknown as AuthListResponse)?.users ?? [])
    .filter((u) => (u.email ?? '').toLowerCase().includes(q))
    .slice(0, 20);

  if (matches.length === 0) return NextResponse.json({ users: [] });

  const ids = matches.map((u) => u.id);
  const { data: rows } = await admin
    .from('users')
    .select('id, display_name, is_admin')
    .in('id', ids);
  const byId = new Map<string, PublicUser>();
  for (const r of (rows ?? []) as PublicUser[]) byId.set(r.id, r);

  return NextResponse.json({
    users: matches.map((m) => ({
      id: m.id,
      email: m.email,
      name: byId.get(m.id)?.display_name ?? m.name ?? null,
      is_admin: byId.get(m.id)?.is_admin ?? false,
    })),
  });
}
