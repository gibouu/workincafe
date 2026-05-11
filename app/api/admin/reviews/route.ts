import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';
import { isEmailAllowlisted } from '@/lib/auth/admin-allowlist';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Admin reviews browser — search / filter / paginate every row in the
 * reviews table. Counterpart to /admin/flagged-reviews which only shows
 * the pending-flag queue. See #136.
 *
 * GET /api/admin/reviews
 *   ?q=&place_id=&user_id=&status=visible|hidden|all
 *   &since=ISO&page=0&pageSize=50&sort=created_at|overall_rating&dir=asc|desc
 */

const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 200;

type SortKey = 'created_at' | 'overall_rating' | 'place_id';
const SORTABLE: ReadonlySet<SortKey> = new Set(['created_at', 'overall_rating', 'place_id']);

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
  const status = searchParams.get('status') ?? 'all'; // 'visible' | 'hidden' | 'all'
  const since = searchParams.get('since')?.trim() ?? '';
  const page = Math.max(0, Number.parseInt(searchParams.get('page') ?? '0', 10) || 0);
  const pageSize = Math.min(
    PAGE_SIZE_MAX,
    Math.max(1, Number.parseInt(searchParams.get('pageSize') ?? String(PAGE_SIZE_DEFAULT), 10) || PAGE_SIZE_DEFAULT),
  );
  const sortRaw = (searchParams.get('sort') ?? 'created_at') as SortKey;
  const sort: SortKey = SORTABLE.has(sortRaw) ? sortRaw : 'created_at';
  const dir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc';

  const admin = createAdminClient();
  let query = admin
    .from('reviews')
    .select(
      'id, place_id, user_id, overall_rating, comment, is_hidden, source, created_at, updated_at, upvotes_count, geo_verified',
      { count: 'exact' },
    );

  if (q) query = query.ilike('comment', `%${q}%`);
  if (placeId) query = query.eq('place_id', placeId);
  if (userId) query = query.eq('user_id', userId);
  if (status === 'visible') query = query.eq('is_hidden', false);
  else if (status === 'hidden') query = query.eq('is_hidden', true);
  if (since && !Number.isNaN(Date.parse(since))) {
    query = query.gte('created_at', since);
  }

  query = query.order(sort, { ascending: dir === 'asc' });
  query = query.range(page * pageSize, page * pageSize + pageSize - 1);

  const { data: reviews, count, error } = await query;
  if (error) {
    if (/relation .* does not exist/i.test(error.message)) {
      return NextResponse.json({ reviews: [], total: 0 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Hydrate place names + submitter emails so the row can show them without
  // a per-row round-trip.
  const placeIds = Array.from(new Set((reviews ?? []).map((r) => r.place_id))).filter(Boolean);
  const userIds = Array.from(new Set((reviews ?? []).map((r) => r.user_id))).filter(Boolean);

  const placeNameById = new Map<string, string>();
  if (placeIds.length > 0) {
    const { data: places } = await admin
      .from('places')
      .select('id, name, city, country')
      .in('id', placeIds);
    for (const p of places ?? []) {
      const meta = [p.city, p.country].filter(Boolean).join(', ');
      placeNameById.set(p.id, meta ? `${p.name} · ${meta}` : p.name);
    }
  }

  const emailByUser = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: authResp } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const wanted = new Set(userIds);
    for (const u of (authResp?.users ?? []) as { id: string; email: string | null }[]) {
      if (wanted.has(u.id) && u.email) emailByUser.set(u.id, u.email);
    }
  }

  const out = (reviews ?? []).map((r) => ({
    ...r,
    place_label: placeNameById.get(r.place_id) ?? null,
    user_email: emailByUser.get(r.user_id) ?? null,
  }));

  return NextResponse.json({
    reviews: out,
    total: count ?? 0,
    page,
    pageSize,
  });
}
