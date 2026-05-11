import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';
import { isEmailAllowlisted } from '@/lib/auth/admin-allowlist';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Per-place admin actions: edit + hard delete. See #135.
 *
 * PATCH /api/admin/places/[id]
 *   Body: { name?, brand?, category?, address?, neighborhood?, city?, country? }
 *   Updates the writable fields on the place row.
 *
 * DELETE /api/admin/places/[id]
 *   Hard delete. FK cascades are configured on related tables (reviews,
 *   claims, owners, menus) so the row removal is safe.
 */

interface PatchBody {
  name?: string;
  brand?: string | null;
  category?: string;
  address?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  country?: string | null;
}

const ALLOWED_CATEGORIES = new Set([
  'cafe', 'bakery', 'library', 'coworking', 'hotel',
  'restaurant', 'fast_food', 'fast_food_burger', 'other',
]);

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
  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim();
  if (body.brand !== undefined) patch.brand = body.brand?.trim() || null;
  if (body.category !== undefined) {
    if (!ALLOWED_CATEGORIES.has(body.category)) {
      return NextResponse.json({ error: 'invalid category' }, { status: 400 });
    }
    patch.category = body.category;
  }
  if (body.address !== undefined) patch.address = body.address?.trim() || null;
  if (body.neighborhood !== undefined) patch.neighborhood = body.neighborhood?.trim() || null;
  if (body.city !== undefined) patch.city = body.city?.trim() || null;
  if (body.country !== undefined) {
    const c = body.country?.trim().toUpperCase() || null;
    if (c !== null && !/^[A-Z]{2}$/.test(c)) {
      return NextResponse.json({ error: 'country must be ISO 3166-1 alpha-2' }, { status: 400 });
    }
    patch.country = c;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no writable fields supplied' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('places')
    .update(patch)
    .eq('id', id)
    .select('id, name, brand, category, address, neighborhood, city, country')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ place: data });
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
    .from('places')
    .delete({ count: 'exact' })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if ((count ?? 0) === 0) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
