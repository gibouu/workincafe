import { notFound } from 'next/navigation';
import Link from 'next/link';
import { findPlace } from '@/lib/demo/cities';
import { categoryMeta } from '@/lib/categories';
import { Icon } from '@/components/icons/Icon';
import { NoiseHeatmap } from '@/components/card/NoiseHeatmap';
import { LiveUpdateTrigger } from '@/components/review/LiveUpdateTrigger';
import { ReviewList } from '@/components/review/ReviewList';
import { reviewsForPlace } from '@/lib/demo/reviews';

export default async function PlaceProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const place = findPlace(id);
  if (!place) notFound();

  const meta = categoryMeta(place.category);
  const reviews = reviewsForPlace(place.id, 3);

  return (
    <div className="min-h-dvh bg-[var(--map-bg)]">
      {/* Hero */}
      <div
        className="relative h-48 w-full"
        style={{
          background: `linear-gradient(180deg, ${meta.color} 0%, ${meta.color}00 100%)`,
        }}
      >
        <Link
          href="/"
          className="absolute top-4 left-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[var(--text-primary)] shadow-float backdrop-blur-ios hover:bg-white transition"
          aria-label="Back"
        >
          <Icon name="ArrowLeft" size={18} />
        </Link>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon name={meta.icon} size={56} weight="regular" className="text-white drop-shadow-sm" />
          <div className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-white/90">
            {meta.label}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-5 py-6">
        <div className="text-[28px] font-semibold leading-tight text-[var(--text-primary)]">
          {place.name}
        </div>
        <div className="mt-1 text-[14px] text-[var(--text-secondary)]">
          {place.address} · {place.neighborhood} · Paris
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <StatCard
            label={`Rating · ${place.review_count}`}
            value={place.rating.toFixed(1)}
            tint="blue"
          />
          <StatCard
            label="Avg spend"
            value={place.avg_spend_eur === 0 ? 'Free' : `€${place.avg_spend_eur}`}
            tint="green"
          />
        </div>

        <a
          href={`https://maps.apple.com/?daddr=${place.lat},${place.lng}&dirflg=w`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 text-[15px] font-semibold text-white hover:opacity-90 transition"
        >
          <span>Take me there</span>
          <Icon name="ArrowRight" size={18} weight="bold" />
        </a>

        <LiveUpdateTrigger place={place} />

        <Link
          href={`/review/new/${place.id}`}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--surface-border)] bg-white py-3 text-[14px] font-semibold text-[var(--text-primary)] hover:bg-sys-gray-6 transition"
        >
          <Icon name="PencilSimple" size={18} />
          <span>Leave a review</span>
        </Link>

        <section className="mt-8">
          <h2 className="mb-3 text-[17px] font-semibold text-[var(--text-primary)]">
            Noise by hour
          </h2>
          <div className="rounded-2xl border border-[var(--surface-border)] bg-white p-4 shadow-card">
            <NoiseHeatmap place={place} />
          </div>
          <p className="mt-2 text-[11px] text-[var(--text-secondary)]">
            Synthetic preview. Real data aggregated from reviews + live updates + decibel tests in
            Phase 3.
          </p>
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[17px] font-semibold text-[var(--text-primary)]">
              Reviews ({place.review_count})
            </h2>
            <Link
              href={`/review/new/${place.id}`}
              className="text-[13px] font-medium text-accent hover:underline"
            >
              Leave yours
            </Link>
          </div>
          <ReviewList reviews={reviews} />
          <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
            Showing a sample. Real reviews from verified check-ins appear once Phase 3 ships.
          </p>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tint,
}: {
  label: string;
  value: string;
  tint: 'blue' | 'green';
}) {
  const cls =
    tint === 'blue'
      ? 'bg-accent-tint text-accent'
      : 'bg-accent-green-tint text-accent-green';
  return (
    <div className={`rounded-2xl p-4 text-center ${cls}`}>
      <div className="text-[28px] font-semibold leading-none">{value}</div>
      <div className="mt-1 text-[11px]">{label}</div>
    </div>
  );
}
