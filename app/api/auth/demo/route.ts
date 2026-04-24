import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  DEMO_SESSION_COOKIE,
  demoSessionCookieOptions,
  isDemoAuthEnabled,
  signDemoSession,
} from '@/lib/demo/auth';

const DEFAULT_DEMO_EMAIL = 'demo@workin.cafe';
const DEFAULT_DEMO_NAME = 'Demo Tester';

function safeNext(value: unknown) {
  if (typeof value !== 'string') return '/profile';
  if (!value.startsWith('/') || value.startsWith('//')) return '/profile';
  return value;
}

async function findUserByEmail(admin: ReturnType<typeof createAdminClient>, email: string) {
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < 100) break;
  }
  return null;
}

async function ensureDemoUser() {
  const admin = createAdminClient();
  const email = process.env.DEMO_AUTH_EMAIL ?? DEFAULT_DEMO_EMAIL;
  const name = process.env.DEMO_AUTH_NAME ?? DEFAULT_DEMO_NAME;

  let user = await findUserByEmail(admin, email);

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name: name,
        name,
        is_demo: true,
      },
      app_metadata: {
        provider: 'demo',
        is_demo: true,
      },
    });

    if (error) throw error;
    user = data.user;
  }

  if (!user) throw new Error('Unable to create demo user');

  const profile = {
    id: user.id,
    display_name: name,
    avatar_url: null,
    trust_score: 10,
    home_city: null,
    is_demo: true,
  };
  const { error } = await admin.from('users').upsert(profile, { onConflict: 'id' });
  if (error && /is_demo/i.test(error.message)) {
    await admin
      .from('users')
      .upsert(
        {
          id: user.id,
          display_name: name,
          avatar_url: null,
          trust_score: 10,
          home_city: null,
        },
        { onConflict: 'id' },
      );
  }

  return { id: user.id, email, name };
}

export async function POST(request: NextRequest) {
  if (!isDemoAuthEnabled()) {
    return NextResponse.json({ error: 'demo auth is disabled' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { next?: string } | null;
  const next = safeNext(body?.next);

  try {
    const user = await ensureDemoUser();
    const token = await signDemoSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      isDemo: true,
    });

    const response = NextResponse.json({ ok: true, redirectTo: next, user });
    response.cookies.set(DEMO_SESSION_COOKIE, token, demoSessionCookieOptions());
    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'demo sign-in failed' },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEMO_SESSION_COOKIE, '', {
    ...demoSessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}
