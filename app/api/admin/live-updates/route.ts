import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';
import { isEmailAllowlisted } from '@/lib/auth/admin-allowlist';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthEmailsByUserId } from '@/lib/auth/admin-users';

/**
 * Admin live-updates monitoring feed — read-only browse of what users
 * submit via the "Live review" CTA (POST /api/live-updates). Counterpart
 * to /admin/reviews; there is no aggregate/feed for these otherwise. #178.
 *
 * GET /api/admin/live-updates
 *   ?q=&place_id=&user_id=&since=ISO&include_demo=1
 *   &page=0&pageSize=50
 */

const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 200;

export async function GET(request: NextRequest) {
  const { db, user } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isEmailAllowlisted(user.email)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { data: me } = await db.from('users').select('is_admin').eq('id', user.id).maybeSingle();
  if (!me?.is_admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';
  const placeId = searchParams.get('place_id')?.trim() ?? '';
  const userId = searchParams.get('user_id')?.trim() ?? '';
  const since = searchParams.get('since')?.trim() ?? '';
  const includeDemo = searchParams.get('include_demo') === '1';
  const page = Math.max(0, Number.parseInt(searchParams.get('page') ?? '0', 10) || 0);
  const pageSize = Math.min(
    PAGE_SIZE_MAX,
    Math.max(
      1,
      Number.parseInt(searchParams.get('pageSize') ?? String(PAGE_SIZE_DEFAULT), 10) ||
        PAGE_SIZE_DEFAULT,
    ),
  );

  const admin = createAdminClient();
  let query = admin
    .from('live_updates')
    .select(
      'id, place_id, user_id, noise_level, seating_availability, temperature, outlets, rotating_question, rotating_answer, created_at, is_demo',
      { count: 'exact' },
    );

  if (placeId) query = query.eq('place_id', placeId);
  if (userId) query = query.eq('user_id', userId);
  if (!includeDemo) query = query.eq('is_demo', false);
  if (since && !Number.isNaN(Date.parse(since))) query = query.gte('created_at', since);
  if (q) query = query.ilike('rotating_answer', `%${q}%`);

  query = query.order('created_at', { ascending: false });
  query = query.range(page * pageSize, page * pageSize + pageSize - 1);

  const { data: rows, count, error } = await query;
  if (error) {
    // Demo-mode contract: missing table → empty, not a 500.
    if (/relation .* does not exist/i.test(error.message)) {
      return NextResponse.json({ updates: [], total: 0, page, pageSize });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Hydrate place names + submitter emails so a row needs no per-row fetch.
  const placeIds = Array.from(new Set((rows ?? []).map((r) => r.place_id))).filter(Boolean);
  const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id))).filter(Boolean);

  const placeLabelById = new Map<string, string>();
  if (placeIds.length > 0) {
    const { data: places } = await admin
      .from('places')
      .select('id, name, city, country')
      .in('id', placeIds);
    for (const p of places ?? []) {
      const meta = [p.city, p.country].filter(Boolean).join(', ');
      placeLabelById.set(p.id, meta ? `${p.name} · ${meta}` : p.name);
    }
  }

  const emailByUser = await getAuthEmailsByUserId(admin, userIds);

  const out = (rows ?? []).map((r) => ({
    ...r,
    place_label: placeLabelById.get(r.place_id) ?? null,
    user_email: emailByUser.get(r.user_id) ?? null,
  }));

  return NextResponse.json({ updates: out, total: count ?? 0, page, pageSize });
}
