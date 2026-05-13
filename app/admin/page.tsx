import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEmailAllowlisted } from '@/lib/auth/admin-allowlist';
import { Icon } from '@/components/icons/Icon';

interface QueueCounts {
  placeRequests: number;
  flaggedReviews: number;
  ownershipClaims: number;
  admins: number;
  places: number;
  reviews: number;
}

interface AdminLite {
  id: string;
  email: string | null;
}

interface AdminPanelData {
  counts: QueueCounts;
  approvedAdmins: AdminLite[];
  selfId: string | null;
}

async function loadPanel(): Promise<AdminPanelData> {
  const emptyCounts: QueueCounts = {
    placeRequests: 0,
    flaggedReviews: 0,
    ownershipClaims: 0,
    admins: 0,
    places: 0,
    reviews: 0,
  };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { counts: emptyCounts, approvedAdmins: [], selfId: null };
  if (!isEmailAllowlisted(user.email)) {
    return { counts: emptyCounts, approvedAdmins: [], selfId: user.id };
  }

  const { data: me } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (!me?.is_admin) return { counts: emptyCounts, approvedAdmins: [], selfId: user.id };

  const admin = createAdminClient();
  // Each count is best-effort — if the table is missing (pre-migration), we
  // surface 0 instead of crashing the whole page.
  const safeCount = async (table: string, filter?: { col: string; val: string }): Promise<number> => {
    let q = admin.from(table).select('id', { head: true, count: 'exact' });
    if (filter) q = q.eq(filter.col, filter.val);
    const { count, error } = await q;
    if (error) return 0;
    return count ?? 0;
  };

  // Admin email list is pulled inline so the index shows who's approved
  // at a glance (instead of forcing a click through to /admin/users).
  // See #155 (the admin-emails feedback). Falls back to an empty list on
  // schema drift.
  const loadAdminEmails = async (): Promise<AdminLite[]> => {
    const { data: rows } = await admin
      .from('users')
      .select('id')
      .eq('is_admin', true);
    if (!rows || rows.length === 0) return [];
    const wantedIds = new Set(rows.map((r) => r.id as string));
    const { data: authResp } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const out: AdminLite[] = [];
    for (const u of (authResp?.users ?? []) as { id: string; email: string | null }[]) {
      if (wantedIds.has(u.id)) {
        out.push({ id: u.id, email: u.email ?? null });
      }
    }
    out.sort((a, b) => (a.email ?? '').localeCompare(b.email ?? ''));
    return out;
  };

  const [placeRequests, flaggedReviews, ownershipClaims, admins, places, reviews, approvedAdmins] =
    await Promise.all([
      safeCount('place_requests', { col: 'status', val: 'pending' }),
      safeCount('flagged_reviews', { col: 'status', val: 'pending' }),
      safeCount('place_claims', { col: 'status', val: 'pending' }),
      safeCount('users', { col: 'is_admin', val: 'true' }),
      safeCount('places'),
      safeCount('reviews'),
      loadAdminEmails(),
    ]);

  return {
    counts: { placeRequests, flaggedReviews, ownershipClaims, admins, places, reviews },
    approvedAdmins,
    selfId: user.id,
  };
}

export default async function AdminIndex() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { counts, approvedAdmins, selfId } = await loadPanel();

  return (
    <div className="min-h-dvh bg-[var(--map-bg)]">
      <div className="mx-auto max-w-3xl px-5 py-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-card"
            aria-label="Back"
          >
            <Icon name="ArrowLeft" size={18} />
          </Link>
          <div className="text-[15px] font-semibold text-[var(--text-primary)]">Admin</div>
          <div className="w-9" />
        </div>

        <h1 className="mt-6 text-[28px] font-bold text-[var(--text-primary)]">Moderation queues</h1>
        <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
          Signed in as {user?.email ?? 'guest'}.
        </p>

        {approvedAdmins.length > 0 && (
          <section className="mt-4 rounded-2xl border border-[var(--surface-border)] bg-white p-4 shadow-card">
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                Approved admins ({approvedAdmins.length})
              </div>
              <Link
                href="/admin/users"
                className="text-[12px] font-semibold text-accent hover:underline"
              >
                Edit
              </Link>
            </div>
            <ul className="mt-2 flex flex-wrap gap-2">
              {approvedAdmins.map((a) => (
                <li
                  key={a.id}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] ${
                    a.id === selfId
                      ? 'bg-accent-tint text-accent font-semibold'
                      : 'bg-sys-gray-6 text-[var(--text-primary)]'
                  }`}
                >
                  <Icon name="UserCircle" size={12} />
                  <span className="truncate">{a.email ?? a.id.slice(0, 8)}</span>
                  {a.id === selfId && (
                    <span className="text-[10px] uppercase tracking-wide">you</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <QueueCard
            href="/admin/place-requests"
            icon="MapPinLine"
            title="Place requests"
            count={counts.placeRequests}
            hint="Approve, reject with reason"
          />
          <QueueCard
            href="/admin/places"
            icon="Compass"
            title="All places"
            count={counts.places}
            hint="Search, edit, delete any row"
          />
          <QueueCard
            href="/admin/reviews"
            icon="ChatText"
            title="All reviews"
            count={counts.reviews}
            hint="Search, hide, restore, delete"
          />
          <QueueCard
            href="/admin/flagged-reviews"
            icon="Flag"
            title="Flagged reviews"
            count={counts.flaggedReviews}
            hint="Dismiss, hide, or ban"
          />
          <QueueCard
            href="/admin/ownership-claims"
            icon="Storefront"
            title="Ownership claims"
            count={counts.ownershipClaims}
            hint="Approve, reject with reason"
          />
          <QueueCard
            href="/admin/users"
            icon="UsersThree"
            title="Admins"
            count={counts.admins}
            hint="Promote / demote by email"
          />
        </div>
      </div>
    </div>
  );
}

function QueueCard({
  href,
  icon,
  title,
  count,
  hint,
}: {
  href: string;
  icon: 'MapPinLine' | 'Flag' | 'Storefront' | 'UsersThree' | 'Compass' | 'ChatText';
  title: string;
  count: number;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-2xl border border-[var(--surface-border)] bg-white p-4 shadow-card hover:shadow-float transition"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-tint text-accent">
        <Icon name={icon} size={22} />
      </div>
      <div className="flex-1">
        <div className="text-[15px] font-semibold text-[var(--text-primary)]">{title}</div>
        <div className="text-[12px] text-[var(--text-secondary)]">{hint}</div>
      </div>
      <div className="text-[22px] font-semibold text-[var(--text-primary)]">{count}</div>
      <Icon name="ArrowRight" size={16} className="text-[var(--text-secondary)]" />
    </Link>
  );
}
