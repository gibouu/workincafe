import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Icon } from '@/components/icons/Icon';
import { DEMO_PLACE_REQUESTS, DEMO_FLAGGED_REVIEWS } from '@/lib/demo/admin';

export default async function AdminIndex() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
          Signed in as {user?.email ?? 'guest'} · ~5–15 min/day per spec §12.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <QueueCard
            href="/admin/place-requests"
            icon="MapPinLine"
            title="Place requests"
            count={DEMO_PLACE_REQUESTS.length}
            hint="Approve, reject with reason"
          />
          <QueueCard
            href="/admin/flagged-reviews"
            icon="Flag"
            title="Flagged reviews"
            count={DEMO_FLAGGED_REVIEWS.length}
            hint="Dismiss, hide, or ban"
          />
          <QueueCard
            href="/admin/ownership-claims"
            icon="Storefront"
            title="Ownership claims"
            count={0}
            hint="Approve, reject with reason"
          />
          <QueueCard
            href="/admin/users"
            icon="UsersThree"
            title="Admins"
            count={0}
            hint="Promote / demote by email"
          />
        </div>

        <div className="mt-8 rounded-2xl border border-[var(--surface-border)] bg-white p-5 shadow-card">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text-primary)]">
            <Icon name="Info" size={16} className="text-accent" />
            <span>Preview only</span>
          </div>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            These queues show demo data. Real data lands after the Phase 1 migration runs and users
            submit places / flag reviews.
          </p>
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
  icon: 'MapPinLine' | 'Flag' | 'Storefront' | 'UsersThree';
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
