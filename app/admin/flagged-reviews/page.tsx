import Link from 'next/link';
import { Icon } from '@/components/icons/Icon';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEmailAllowlisted } from '@/lib/auth/admin-allowlist';
import { FlaggedReviewRow, type FlaggedReviewRecord } from '@/components/admin/FlaggedReviewRow';

async function loadFlagged(): Promise<FlaggedReviewRecord[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  if (!isEmailAllowlisted(user.email)) return [];

  const { data: me } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (!me?.is_admin) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('flagged_reviews')
    .select(
      'id, reason, notes, created_at, reviews(id, comment, overall_rating, geo_verified, user_id, places(name))',
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return [];
  return ((data ?? []) as unknown) as FlaggedReviewRecord[];
}

export default async function FlaggedReviewsPage() {
  const flagged = await loadFlagged();

  return (
    <div className="min-h-dvh bg-[var(--map-bg)]">
      <div className="mx-auto max-w-3xl px-5 py-6">
        <div className="flex items-center justify-between">
          <Link
            href="/admin"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-card"
            aria-label="Back"
          >
            <Icon name="ArrowLeft" size={18} />
          </Link>
          <div className="text-[15px] font-semibold text-[var(--text-primary)]">
            Flagged reviews
          </div>
          <div className="w-9" />
        </div>

        <h1 className="mt-6 text-[28px] font-bold text-[var(--text-primary)]">Pending</h1>
        <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
          {flagged.length === 0
            ? 'Nothing flagged. Reports from users land here.'
            : `${flagged.length} pending`}
        </p>

        {flagged.length > 0 && (
          <ul className="mt-6 flex flex-col gap-3">
            {flagged.map((f) => (
              <FlaggedReviewRow key={f.id} flag={f} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
