'use client';

import { useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { FlagReviewSheet } from '@/components/review/FlagReviewSheet';
import type { DemoReview } from '@/lib/demo/reviews';

export function ReviewList({ reviews }: { reviews: DemoReview[] }) {
  const [flagId, setFlagId] = useState<string | null>(null);

  if (reviews.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--surface-border)] bg-white p-6 text-center text-[13px] text-[var(--text-secondary)] shadow-card">
        No reviews yet — be the first. Full review flow ships in Phase 3.
      </div>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {reviews.map((r) => (
          <li
            key={r.id}
            className="rounded-2xl border border-[var(--surface-border)] bg-white p-4 shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sys-gray-5 text-[13px] font-semibold text-[var(--text-primary)]">
                  {r.initials}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-[14px] font-semibold text-[var(--text-primary)]">
                    <span>{r.author}</span>
                    {r.trust >= 80 && (
                      <span
                        className="inline-flex items-center gap-0.5 rounded-full bg-accent-amber-tint px-1.5 py-0.5 text-[10px] font-semibold text-accent-amber"
                        title="Veteran — top 10% per city"
                      >
                        <Icon name="Medal" size={10} weight="fill" />
                        <span>Veteran</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                    <span>{r.createdAgo}</span>
                    {r.geoVerified && (
                      <span className="inline-flex items-center gap-0.5 text-accent-green">
                        <Icon name="CheckCircle" size={10} weight="fill" />
                        <span>Verified on site</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                aria-label="Flag this review"
                onClick={() => setFlagId(r.id)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-sys-gray-6 hover:text-[var(--text-primary)] transition"
              >
                <Icon name="Flag" size={14} />
              </button>
            </div>

            <div className="mt-2 flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Icon
                  key={n}
                  name="Star"
                  size={14}
                  weight={n <= r.rating ? 'fill' : 'regular'}
                  className={n <= r.rating ? 'text-accent-amber' : 'text-sys-gray-4'}
                />
              ))}
              {(r.wifi !== undefined || r.noise !== undefined || r.seating !== undefined) && (
                <div className="ml-2 flex gap-2 text-[11px] text-[var(--text-secondary)]">
                  {r.wifi !== undefined && <span>Wi-Fi {r.wifi}</span>}
                  {r.noise !== undefined && <span>Noise {r.noise}</span>}
                  {r.seating !== undefined && <span>Seat {r.seating}</span>}
                </div>
              )}
            </div>

            <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-primary)]">
              {r.comment}
            </p>
          </li>
        ))}
      </ul>

      <FlagReviewSheet
        open={flagId !== null}
        onOpenChange={(next) => {
          if (!next) setFlagId(null);
        }}
        reviewId={flagId}
      />
    </>
  );
}
