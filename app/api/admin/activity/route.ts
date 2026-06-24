import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';
import { isEmailAllowlisted } from '@/lib/auth/admin-allowlist';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthEmailsByUserId } from '@/lib/auth/admin-users';

/**
 * Admin recent-activity feed (#167, final slice). A read-only union over
 * the decision columns the moderation queues already stamp — no audit
 * table, no write-path instrumentation, no migration. Reflects every
 * single + bulk action from #176/#177/#180/#181 automatically.
 *
 * GET /api/admin/activity?kind=all|place_request|flagged_review
 *   &page=0&pageSize=50
 *
 * Strategy: pull the most-recent N decided rows from each source table,
 * merge, sort by decision time desc, then page in app code. N is capped
 * so the union stays bounded regardless of total history.
 */

const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 100;
const PER_SOURCE_CAP = 300;

type Kind = 'place_request' | 'flagged_review';

interface ActivityEvent {
  id: string;
  kind: Kind;
  action: string;
  target: string;
  detail: string | null;
  actor_email: string | null;
  actor_id: string | null;
  at: string;
}

export async function GET(request: NextRequest) {
  const { db, user } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isEmailAllowlisted(user.email)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { data: me } = await db.from('users').select('is_admin').eq('id', user.id).maybeSingle();
  if (!me?.is_admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const kind = searchParams.get('kind') ?? 'all';
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
  const events: ActivityEvent[] = [];

  if (kind === 'all' || kind === 'place_request') {
    const { data } = await admin
      .from('place_requests')
      .select('id, name, status, rejection_reason, reviewed_by, reviewed_at')
      .neq('status', 'pending')
      .not('reviewed_at', 'is', null)
      .order('reviewed_at', { ascending: false })
      .limit(PER_SOURCE_CAP);
    for (const r of data ?? []) {
      events.push({
        id: `pr:${r.id}`,
        kind: 'place_request',
        action: r.status as string, // 'approved' | 'rejected'
        target: (r.name as string) ?? '(unnamed place)',
        detail: (r.rejection_reason as string | null) ?? null,
        actor_email: null,
        actor_id: (r.reviewed_by as string | null) ?? null,
        at: r.reviewed_at as string,
      });
    }
  }

  if (kind === 'all' || kind === 'flagged_review') {
    const { data } = await admin
      .from('flagged_reviews')
      .select('id, review_id, status, resolution, resolved_by, resolved_at')
      .neq('status', 'pending')
      .not('resolved_at', 'is', null)
      .order('resolved_at', { ascending: false })
      .limit(PER_SOURCE_CAP);
    for (const r of data ?? []) {
      // resolution is "<action> · <optional reason>" (see decide-flagged-review).
      const resolution = (r.resolution as string | null) ?? '';
      const [act, ...rest] = resolution.split(' · ');
      events.push({
        id: `fr:${r.id}`,
        kind: 'flagged_review',
        action: act || (r.status === 'rejected' ? 'dismiss' : 'resolved'),
        target: `review ${String(r.review_id).slice(0, 8)}`,
        detail: rest.join(' · ') || null,
        actor_email: null,
        actor_id: (r.resolved_by as string | null) ?? null,
        at: r.resolved_at as string,
      });
    }
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const total = events.length;
  const slice = events.slice(page * pageSize, page * pageSize + pageSize);

  // Hydrate actor emails for just the visible page.
  const actorIds = Array.from(
    new Set(slice.map((e) => e.actor_id).filter((x): x is string => !!x)),
  );
  const emailById = await getAuthEmailsByUserId(admin, actorIds);
  for (const e of slice) {
    if (e.actor_id) {
      e.actor_email = emailById.get(e.actor_id) ?? null;
    }
  }

  return NextResponse.json({ events: slice, total, page, pageSize });
}
