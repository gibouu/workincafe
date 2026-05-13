import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';
import { isEmailAllowlisted } from '@/lib/auth/admin-allowlist';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/admin/places/[id]/merge-into
 *   Body: { target_id: string }
 *
 * Collapses the [id] place into target_id by transferring every FK
 * reference and deleting [id]. Backed by the admin_merge_places(source,
 * target) Postgres function (migration 027). See the dedup follow-up
 * discussion in #163 for the philosophy.
 *
 * Returns: { summary: { reviews: N, checkins: N, ... } }
 */

interface Body {
  target_id?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { db, user } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isEmailAllowlisted(user.email)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { data: me } = await db.from('users').select('is_admin').eq('id', user.id).maybeSingle();
  if (!me?.is_admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id: sourceId } = await params;
  const body = (await request.json().catch(() => null)) as Body | null;
  const targetId = body?.target_id?.trim();

  if (!UUID_RE.test(sourceId)) {
    return NextResponse.json({ error: 'invalid source id' }, { status: 400 });
  }
  if (!targetId || !UUID_RE.test(targetId)) {
    return NextResponse.json({ error: 'target_id required (uuid)' }, { status: 400 });
  }
  if (sourceId === targetId) {
    return NextResponse.json({ error: 'source and target must differ' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('admin_merge_places', {
    p_source: sourceId,
    p_target: targetId,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ summary: data ?? {} });
}
