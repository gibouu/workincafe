import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';
import { isEmailAllowlisted } from '@/lib/auth/admin-allowlist';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Admin places browser — search / filter / paginate the entire places
 * table. Counterpart to /admin/place-requests for already-approved rows.
 * See #135.
 *
 * GET /api/admin/places?q=&city=&country=&category=&page=0&pageSize=50&sort=name
 */

const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 200;

type SortKey = 'name' | 'city' | 'country' | 'category' | 'created_at';
const SORTABLE: ReadonlySet<SortKey> = new Set(['name', 'city', 'country', 'category', 'created_at']);

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
  const city = searchParams.get('city')?.trim() ?? '';
  const country = searchParams.get('country')?.trim().toUpperCase() ?? '';
  const category = searchParams.get('category')?.trim() ?? '';
  const page = Math.max(0, Number.parseInt(searchParams.get('page') ?? '0', 10) || 0);
  const pageSize = Math.min(
    PAGE_SIZE_MAX,
    Math.max(1, Number.parseInt(searchParams.get('pageSize') ?? String(PAGE_SIZE_DEFAULT), 10) || PAGE_SIZE_DEFAULT),
  );
  const sortRaw = (searchParams.get('sort') ?? 'name') as SortKey;
  const sort: SortKey = SORTABLE.has(sortRaw) ? sortRaw : 'name';
  const dir = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';

  const admin = createAdminClient();
  let query = admin
    .from('places')
    .select(
      'id, name, address, neighborhood, city, country, category, brand, lat, lng, created_at, parent_place_id, user_validated_at',
      { count: 'exact' },
    );

  if (q) {
    // pg_trgm on name + ILIKE on address keeps queries snappy for the
    // typical "find this exact place" admin workflow.
    query = query.or(`name.ilike.%${q}%,address.ilike.%${q}%,brand.ilike.%${q}%`);
  }
  if (city) query = query.ilike('city', city);
  if (country) query = query.eq('country', country);
  if (category) query = query.eq('category', category);

  query = query.order(sort, { ascending: dir === 'asc' });
  query = query.range(page * pageSize, page * pageSize + pageSize - 1);

  const { data, count, error } = await query;
  if (error) {
    if (/relation .* does not exist/i.test(error.message)) {
      return NextResponse.json({ places: [], total: 0 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    places: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
  });
}
