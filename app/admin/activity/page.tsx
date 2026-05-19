import Link from 'next/link';
import { Icon } from '@/components/icons/Icon';
import { createClient } from '@/lib/supabase/server';
import { isEmailAllowlisted } from '@/lib/auth/admin-allowlist';
import { AdminActivityFeed } from '@/components/admin/AdminActivityFeed';

export const metadata = { title: 'Activity · Admin · Work in Cafe' };

export default async function AdminActivityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isEmailAllowlisted(user.email)) {
    return (
      <div className="min-h-dvh bg-(--map-bg) p-6">
        <div className="mx-auto max-w-md rounded-2xl border border-(--surface-border) bg-white p-6 text-center shadow-card">
          <div className="text-[15px] font-semibold text-(--text-primary)">
            Sign in as an admin to view this page.
          </div>
        </div>
      </div>
    );
  }
  const { data: me } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (!me?.is_admin) {
    return (
      <div className="min-h-dvh bg-(--map-bg) p-6">
        <div className="mx-auto max-w-md rounded-2xl border border-(--surface-border) bg-white p-6 text-center shadow-card">
          <div className="text-[15px] font-semibold text-(--text-primary)">
            Admin access required.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-(--map-bg)">
      <div className="mx-auto max-w-3xl px-5 py-6">
        <div className="flex items-center justify-between">
          <Link
            href="/admin"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-card"
            aria-label="Back"
          >
            <Icon name="ArrowLeft" size={18} />
          </Link>
          <div className="text-[15px] font-semibold text-(--text-primary)">Activity</div>
          <div className="w-9" />
        </div>
        <h1 className="mt-6 text-[28px] font-bold text-(--text-primary)">Recent activity</h1>
        <p className="mt-1 text-[14px] text-(--text-secondary)">
          Approvals, rejections, dismissals and hides across the moderation
          queues — who did what, when.
        </p>
        <div className="mt-6">
          <AdminActivityFeed />
        </div>
      </div>
    </div>
  );
}
