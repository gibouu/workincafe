import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';

interface Body {
  occupation?: string;
  work_style?: 'quiet_focus' | 'brainstormer' | 'idea_bouncer' | 'company_only' | null;
  looking_for?: string[];
  industry?: string[];
  gender?: 'woman' | 'man' | 'non_binary' | 'prefer_not_to_say' | null;
  open_to?: string[];
  bio?: string;
  active?: boolean;
}

const WORK_STYLES = new Set(['quiet_focus', 'brainstormer', 'idea_bouncer', 'company_only']);
const GENDERS = new Set(['woman', 'man', 'non_binary', 'prefer_not_to_say']);

export async function GET(request: NextRequest) {
  const { db, user } = await getRequestActor(request);
  if (!user) return NextResponse.json({ profile: null }, { status: 401 });

  const { data, error } = await db
    .from('friend_profiles')
    .select(
      'user_id, occupation, work_style, looking_for, industry, gender, open_to, bio, active, updated_at',
    )
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    const code = (error as { code?: string }).code ?? '';
    if (code === '42P01') return NextResponse.json({ profile: null }, { status: 200 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ profile: data ?? null });
}

export async function PUT(request: NextRequest) {
  const { db, user, isDemo } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: 'body required' }, { status: 400 });

  if (body.work_style != null && !WORK_STYLES.has(body.work_style)) {
    return NextResponse.json({ error: 'invalid work_style' }, { status: 400 });
  }
  if (body.gender != null && !GENDERS.has(body.gender)) {
    return NextResponse.json({ error: 'invalid gender' }, { status: 400 });
  }

  const payload = {
    user_id: user.id,
    occupation: body.occupation?.trim().slice(0, 80) ?? null,
    work_style: body.work_style ?? null,
    looking_for: body.looking_for ?? [],
    industry: body.industry ?? [],
    gender: body.gender ?? null,
    open_to: body.open_to ?? [],
    bio: body.bio?.trim().slice(0, 280) ?? null,
    active: body.active ?? true,
    updated_at: new Date().toISOString(),
    ...(isDemo ? { is_demo: true } : {}),
  };

  const { error } = await db.from('friend_profiles').upsert(payload, { onConflict: 'user_id' });
  if (error) {
    const code = (error as { code?: string }).code ?? '';
    if (code === '42P01') return NextResponse.json({ ok: true }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
