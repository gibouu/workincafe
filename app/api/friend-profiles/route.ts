import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';

interface Body {
  occupation?: string;
  work_style?: 'quiet_focus' | 'brainstormer' | 'idea_bouncer' | 'company_only' | null;
  looking_for?: string[];
  industry?: string[];
  gender?: 'woman' | 'man' | 'prefer_not_to_say' | null;
  open_to?: string[];
  bio?: string;
  active?: boolean;
}

const WORK_STYLES = new Set(['quiet_focus', 'brainstormer', 'idea_bouncer', 'company_only']);
const GENDERS = new Set(['woman', 'man', 'prefer_not_to_say']);

/**
 * Detects "the table doesn't exist yet" across the various error shapes
 * Postgres / PostgREST / Supabase return:
 *   - 42P01    Postgres "relation does not exist"
 *   - PGRST205 PostgREST schema cache miss ("Could not find the table …")
 *   - free-text "schema cache" / "Could not find the table"
 */
function isMissingTable(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string; details?: string; hint?: string };
  if (e.code === '42P01' || e.code === 'PGRST205') return true;
  const blob = `${e.message ?? ''} ${e.details ?? ''} ${e.hint ?? ''}`;
  return /schema cache|Could not find the table|relation .* does not exist/i.test(blob);
}

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
    if (isMissingTable(error)) {
      // Migration 007 not applied yet — soft success. Client renders an
      // empty profile and the wizard.
      return NextResponse.json({ profile: null, deferred: true }, { status: 200 });
    }
    return NextResponse.json({ error: (error as { message?: string }).message ?? 'failed' }, { status: 500 });
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
    if (isMissingTable(error)) {
      return NextResponse.json({ error: 'friend profiles unavailable' }, { status: 503 });
    }
    return NextResponse.json({ error: (error as { message?: string }).message ?? 'failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
