import Link from 'next/link';
import { Icon } from '@/components/icons/Icon';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEmailAllowlisted } from '@/lib/auth/admin-allowlist';

const REASON_LABEL: Record<string, string> = {
  spam: 'Spam',
  offensive: 'Offensive',
  untrue: 'Untrue',
  irrelevant: 'Irrelevant',
  other: 'Other',
};

interface FlaggedReviewRow {
  id: string;
  reason: string;
  notes: string | null;
  created_at: string;
  reviews: {
    id: string;
    comment: string | null;
    overall_rating: number | null;
    geo_verified: boolean | null;
    user_id: string;
    places: { name: string | null } | null;
  } | null;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const d = Math.floor(hr / 24);
  return `${d} d ago`;
}

async function loadFlagged(): Promise<FlaggedReviewRow[]> {
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
  return ((data ?? []) as unknown) as FlaggedReviewRow[];
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
              <li
                key={f.id}
                className="rounded-2xl border border-[var(--surface-border)] bg-white p-4 shadow-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[15px] font-semibold text-[var(--text-primary)]">
                      {f.reviews?.places?.name ?? '(place not found)'}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
                      <span className="rounded-full bg-accent-red-tint px-2 py-0.5 text-accent-red font-semibold">
                        {REASON_LABEL[f.reason] ?? f.reason}
                      </span>
                      <span>flagged {timeAgo(f.created_at)}</span>
                    </div>
                  </div>
                  {f.reviews && (
                    <div className="shrink-0 text-right">
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
                        <Icon
                          name={f.reviews.geo_verified ? 'CheckCircle' : 'Warning'}
                          size={12}
                          weight="fill"
                          className={
                            f.reviews.geo_verified ? 'text-accent-green' : 'text-accent-amber'
                          }
                        />
                        <span>{f.reviews.geo_verified ? 'Geo-verified' : 'Unverified'}</span>
                      </div>
                    </div>
                  )}
                </div>

                {f.notes && (
                  <div className="mt-2 rounded-xl bg-sys-gray-6 px-3 py-2 text-[12px] text-[var(--text-secondary)]">
                    <span className="font-semibold">Reporter notes:</span> {f.notes}
                  </div>
                )}

                {f.reviews?.comment && (
                  <blockquote className="mt-3 border-l-2 border-sys-gray-4 pl-3 text-[13px] italic text-[var(--text-primary)]">
                    {f.reviews.comment}
                  </blockquote>
                )}
              </li>
            ))}
          </ul>
        )}

        {flagged.length > 0 && (
          <div className="mt-6 rounded-2xl border border-[var(--surface-border)] bg-white p-4 text-[12px] text-[var(--text-secondary)]">
            Dismiss / hide / ban actions land in a follow-up — these reports are read-only for now.
          </div>
        )}
      </div>
    </div>
  );
}
