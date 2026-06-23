import Link from 'next/link';
import { Icon } from '@/components/icons/Icon';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEmailAllowlisted } from '@/lib/auth/admin-allowlist';
import { type FlaggedReviewRecord } from '@/components/admin/FlaggedReviewRow';
import { FlaggedReviewsQueue } from '@/components/admin/FlaggedReviewsQueue';

interface FlaggedReviewsLoadResult {
  flagged: FlaggedReviewRecord[];
  error: string | null;
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message ?? '';
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /relation .* does not exist/i.test(message) ||
    /Could not find the table/i.test(message) ||
    /schema cache/i.test(message)
  );
}

async function loadFlagged(): Promise<FlaggedReviewsLoadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { flagged: [], error: null };
  if (!isEmailAllowlisted(user.email)) return { flagged: [], error: null };

  const { data: me } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (!me?.is_admin) return { flagged: [], error: null };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('flagged_reviews')
    .select(
      'id, reason, notes, created_at, reviews(id, comment, overall_rating, geo_verified, user_id, places(name))',
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    if (isMissingTableError(error)) return { flagged: [], error: null };
    return {
      flagged: [],
      error: error.message ?? 'Flagged reviews could not be loaded.',
    };
  }
  return {
    flagged: ((data ?? []) as unknown) as FlaggedReviewRecord[],
    error: null,
  };
}

export default async function FlaggedReviewsPage() {
  const { flagged, error } = await loadFlagged();

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
          <div className="text-[15px] font-semibold text-(--text-primary)">
            Flagged reviews
          </div>
          <div className="w-9" />
        </div>

        <h1 className="mt-6 text-[28px] font-bold text-(--text-primary)">Pending</h1>
        {error ? (
          <div className="mt-2 rounded-2xl border border-red-200 bg-red-50 p-5 text-[13px] text-red-700 shadow-card">
            <div className="font-semibold">Unable to load flagged reviews</div>
            <div className="mt-1">{error}</div>
          </div>
        ) : (
          <FlaggedReviewsQueue flagged={flagged} />
        )}
      </div>
    </div>
  );
}
