import Link from 'next/link';
import { Icon } from '@/components/icons/Icon';
import { DEMO_FLAGGED_REVIEWS } from '@/lib/demo/admin';

const REASON_LABEL: Record<string, string> = {
  spam: 'Spam',
  offensive: 'Offensive',
  untrue: 'Untrue',
  irrelevant: 'Irrelevant',
  other: 'Other',
};

export default function FlaggedReviewsPage() {
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
          {DEMO_FLAGGED_REVIEWS.length} pending · demo data
        </p>

        <ul className="mt-6 flex flex-col gap-3">
          {DEMO_FLAGGED_REVIEWS.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-[var(--surface-border)] bg-white p-4 shadow-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[15px] font-semibold text-[var(--text-primary)]">
                    {r.placeName}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
                    <span className="rounded-full bg-accent-red-tint px-2 py-0.5 text-accent-red font-semibold">
                      {REASON_LABEL[r.reason]}
                    </span>
                    <span>reported by {r.reporter} · {r.flaggedAgo}</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[10px] text-[var(--text-tertiary)]">Author trust</div>
                  <div
                    className={`text-[15px] font-semibold ${
                      r.authorTrust < 20 ? 'text-accent-red' : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {r.authorTrust}
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
                    <Icon
                      name={r.geoVerified ? 'CheckCircle' : 'Warning'}
                      size={12}
                      weight="fill"
                      className={r.geoVerified ? 'text-accent-green' : 'text-accent-amber'}
                    />
                    <span>{r.geoVerified ? 'Geo-verified' : 'Unverified'}</span>
                  </div>
                </div>
              </div>

              {r.notes && (
                <div className="mt-2 rounded-xl bg-sys-gray-6 px-3 py-2 text-[12px] text-[var(--text-secondary)]">
                  <span className="font-semibold">Reporter notes:</span> {r.notes}
                </div>
              )}

              <blockquote className="mt-3 border-l-2 border-sys-gray-4 pl-3 text-[13px] italic text-[var(--text-primary)]">
                {r.reviewText}
              </blockquote>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-[var(--surface-border)] bg-white py-2 text-[13px] font-semibold text-[var(--text-primary)] hover:bg-sys-gray-6 transition"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-accent-amber py-2 text-[13px] font-semibold text-white hover:opacity-90 transition"
                >
                  Hide review
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-accent-red py-2 text-[13px] font-semibold text-white hover:opacity-90 transition"
                >
                  Ban user
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
