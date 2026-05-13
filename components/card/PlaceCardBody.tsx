'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Icon, type PhosphorIconName } from '@/components/icons/Icon';
import { categoryMeta } from '@/lib/categories';
import { useToasts } from '@/lib/store/toasts';
import type {
  DemoPlace,
  WifiBucket,
  NoiseBucket,
  OutletsBucket,
  SeatsBucket,
  LightingBucket,
} from '@/lib/demo/paris-places';
import { VitalsTile } from '@/components/card/VitalsTile';
import { NoiseHeatmap } from '@/components/card/NoiseHeatmap';
import { PlaceDealsSection } from '@/components/card/PlaceDealsSection';
import { ReviewList } from '@/components/review/ReviewList';
import { AllReviewsSheet } from '@/components/review/AllReviewsSheet';
import { LiveUpdateSheet } from '@/components/review/LiveUpdateSheet';
import { ReviewForm } from '@/components/review/ReviewForm';
import { MenuSheet, type PlaceMenu } from '@/components/card/MenuSheet';
import type { DemoReview, ReviewPhoto } from '@/lib/demo/reviews';
import { formatStayLimit } from '@/lib/format/stay-limit';

const WIFI_ICON: Record<WifiBucket, PhosphorIconName> = {
  fast: 'WifiHigh',
  moderate: 'WifiMedium',
  slow: 'WifiLow',
  unknown: 'WifiSlash',
};
const WIFI_LABEL: Record<WifiBucket, string> = {
  fast: 'Fast',
  moderate: 'OK',
  slow: 'Slow',
  unknown: 'Unknown',
};

const NOISE_ICON: Record<NoiseBucket, PhosphorIconName> = {
  quiet: 'SpeakerSimpleLow',
  moderate: 'SpeakerSimpleLow',
  loud: 'SpeakerSimpleHigh',
  unknown: 'SpeakerSimpleSlash',
};
const NOISE_LABEL: Record<NoiseBucket, string> = {
  quiet: 'Quiet',
  moderate: 'Moderate',
  loud: 'Loud',
  unknown: 'Unknown',
};

const OUTLETS_LABEL: Record<OutletsBucket, string> = {
  many: 'Many',
  some: 'Some',
  none: 'None',
  unknown: 'Unknown',
};

const SEATS_LABEL: Record<SeatsBucket, string> = {
  plenty: 'Plenty',
  some: 'Some',
  full: 'Full',
  unknown: 'Unknown',
};

const LIGHTING_ICON: Record<LightingBucket, PhosphorIconName> = {
  good: 'Sun',
  dim: 'SunDim',
  unknown: 'SunDim',
};
const LIGHTING_LABEL: Record<LightingBucket, string> = {
  good: 'Good',
  dim: 'Dim',
  unknown: 'Unknown',
};

export function PlaceCardBody({
  place,
  onClose,
  showHero = true,
}: {
  place: DemoPlace;
  onClose: () => void;
  showHero?: boolean;
}) {
  const [allReviewsOpen, setAllReviewsOpen] = useState(false);
  const [allReviewsInitiallyOnlyPhotos, setAllReviewsInitiallyOnlyPhotos] = useState(false);
  const [liveUpdateOpen, setLiveUpdateOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menus, setMenus] = useState<PlaceMenu[]>([]);
  useEffect(() => {
    let aborted = false;
    fetch(`/api/places/${encodeURIComponent(place.id)}/menus`)
      .then((r) => (r.ok ? r.json() : { menus: [] }))
      .then((body: { menus?: PlaceMenu[] }) => {
        if (!aborted) setMenus(body.menus ?? []);
      })
      .catch(() => null);
    return () => {
      aborted = true;
    };
  }, [place.id]);

  const [realReviews, setRealReviews] = useState<DemoReview[] | null>(null);
  useEffect(() => {
    let aborted = false;
    fetch(`/api/places/${encodeURIComponent(place.id)}/reviews?limit=5`)
      .then((r) => (r.ok ? r.json() : { reviews: [] }))
      .then((body: { reviews: unknown[] }) => {
        if (aborted) return;
        const mapped = (body.reviews ?? []).map(mapDbReviewToDemoShape);
        setRealReviews(mapped);
      })
      .catch(() => setRealReviews([]));
    return () => {
      aborted = true;
    };
  }, [place.id]);
  const allReviews: DemoReview[] = useMemo(() => realReviews ?? [], [realReviews]);
  const previewReviews = useMemo(() => allReviews.slice(0, 3), [allReviews]);
  const realReviewCount = realReviews?.length ?? 0;
  const [favorite, setFavorite] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return JSON.parse(window.localStorage.getItem('wic:favorites') ?? '[]').includes(place.id);
    } catch {
      return false;
    }
  });
  const showToast = useToasts((s) => s.show);
  const meta = categoryMeta(place.category);
  const directionsHref = `https://maps.apple.com/?daddr=${place.lat},${place.lng}&dirflg=w`;

  const persistFavoriteLocal = (next: boolean) => {
    try {
      const key = 'wic:favorites';
      const current: string[] = JSON.parse(window.localStorage.getItem(key) ?? '[]');
      const set = new Set(current);
      if (next) set.add(place.id);
      else set.delete(place.id);
      window.localStorage.setItem(key, JSON.stringify([...set]));
    } catch {
      // ignore
    }
  };

  const toggleFavorite = () => {
    const next = !favorite;
    setFavorite(next);
    persistFavoriteLocal(next);
    showToast(next ? `Saved ${place.name}` : `Removed ${place.name}`, { tone: 'info' });
    // Best-effort DB sync; silently ignore 401/503 (unauth, not migrated).
    void fetch('/api/favorites' + (next ? '' : `?place_id=${encodeURIComponent(place.id)}`), {
      method: next ? 'POST' : 'DELETE',
      headers: next ? { 'content-type': 'application/json' } : undefined,
      body: next ? JSON.stringify({ place_id: place.id }) : undefined,
    }).catch(() => null);
  };

  const liveReview = () => setLiveUpdateOpen(true);

  if (reviewMode) {
    return (
      <div className="flex flex-1 min-h-0 flex-col">
        <ReviewForm place={place} compact onClose={() => setReviewMode(false)} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {showHero && (
        <div
          className="relative h-[60px] w-full shrink-0 flex items-center justify-center rounded-t-3xl md:rounded-t-2xl"
          style={{
            background: `linear-gradient(180deg, ${meta.color} 0%, ${meta.color}00 100%)`,
          }}
        >
          <Icon name={meta.icon} size={40} weight="regular" className="text-white drop-shadow-sm" />
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <div className="flex items-start justify-between gap-3 pt-4">
          <div className="min-w-0">
            <div className="text-[22px] font-semibold leading-tight text-[var(--text-primary)]">
              {place.name}
            </div>
            {place.parent && (
              <div className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--text-secondary)]">
                <Icon name="Bed" size={12} className="text-[var(--text-tertiary)]" />
                <span>Inside {place.parent.name}</span>
              </div>
            )}
            {place.membership_required && (
              <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-accent-tint px-2 py-0.5 text-[11px] font-semibold text-accent">
                <Icon name="Lock" size={10} weight="fill" />
                <span>{place.membership_required}</span>
              </div>
            )}
            <div className="mt-1 text-[13px] text-[var(--text-secondary)] truncate">
              {place.address} · {place.neighborhood}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full bg-sys-gray-6 p-1.5 text-[var(--text-secondary)] hover:bg-sys-gray-5 transition"
          >
            <Icon name="X" size={16} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-accent-tint p-3 text-center">
            <div className="text-[22px] font-semibold text-accent">
              {place.review_count > 0 ? place.rating.toFixed(1) : '—'}
            </div>
            <div className="text-[11px] text-accent mt-0.5">
              {realReviewCount > 0
                ? `Rating · ${realReviewCount} review${realReviewCount === 1 ? '' : 's'}`
                : place.review_count > 0
                  ? 'Preliminary'
                  : 'No reviews yet'}
            </div>
          </div>
          <div className="rounded-2xl bg-accent-green-tint p-3 text-center">
            <div className="text-[22px] font-semibold text-accent-green">
              {place.avg_spend_eur === 0 ? 'Free' : `€${place.avg_spend_eur}`}
            </div>
            <div className="text-[11px] text-accent-green mt-0.5">Avg spend</div>
          </div>
        </div>

        <a
          href={directionsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-accent text-white py-3.5 text-[15px] font-semibold hover:opacity-90 transition"
        >
          <span>Take me there</span>
          <Icon name="ArrowRight" size={18} weight="bold" />
        </a>

        <div className="mt-3 flex gap-2">
          <ChipButton
            icon="PencilSimple"
            label="Review"
            onClick={() => setReviewMode(true)}
          />
          <ChipButton icon="MapPinLine" label="Live review" onClick={liveReview} />
          {menus.length > 0 && (
            <ChipButton
              icon="ForkKnife"
              label={`Menu · ${menus.length}`}
              onClick={() => setMenuOpen(true)}
            />
          )}
          <ChipButton
            icon="Heart"
            iconWeight={favorite ? 'fill' : 'regular'}
            label={favorite ? 'Saved' : 'Save'}
            onClick={toggleFavorite}
            highlighted={favorite}
          />
        </div>
        <p className="mt-2 text-[11px] leading-snug text-[var(--text-tertiary)]">
          A live review describes what&apos;s happening right now. A full review describes a visit.
          You can post again later when conditions change.
        </p>

        {(place.coffee_review_count ?? 0) > 0 && place.coffee_rating != null && (
          <div className="mt-3 flex items-center gap-2.5 rounded-2xl bg-accent-amber-tint px-3 py-2.5">
            <Icon
              name="Coffee"
              weight="fill"
              size={18}
              className="text-accent-amber shrink-0"
            />
            <span className="text-[13px] font-medium text-[var(--text-primary)]">
              Known for their coffee
            </span>
            <span className="ml-auto text-[14px] font-semibold text-accent-amber tabular-nums">
              {place.coffee_rating.toFixed(1)}
            </span>
          </div>
        )}

        <div className="mt-5">
          <div className="text-[13px] font-semibold text-[var(--text-primary)] mb-2">
            Study vitals
          </div>
          <div className="grid grid-cols-3 gap-2">
            <VitalsTile icon={WIFI_ICON[place.wifi]} label="Wifi" value={WIFI_LABEL[place.wifi]} />
            <VitalsTile
              icon={NOISE_ICON[place.noise]}
              label="Noise"
              value={NOISE_LABEL[place.noise]}
            />
            <VitalsTile icon="Plug" label="Outlets" value={OUTLETS_LABEL[place.outlets]} />
            <VitalsTile icon="Armchair" label="Seats" value={SEATS_LABEL[place.seats]} />
            <VitalsTile
              icon={LIGHTING_ICON[place.lighting]}
              label="Lighting"
              value={LIGHTING_LABEL[place.lighting]}
            />
            <VitalsTile
              icon="Clock"
              label="Stay limit"
              value={formatStayLimit(place.tabletime_hours)}
            />
          </div>
        </div>

        <PlaceDealsSection placeId={place.id} />

        <div className="mt-5">
          <div className="text-[13px] font-semibold text-[var(--text-primary)] mb-2">
            Right now
          </div>
          <div className="rounded-2xl border border-[var(--surface-border)] bg-white/70 divide-y divide-[var(--divider)]">
            <RightNowRow icon={NOISE_ICON[place.noise]} text={place.right_now_noise} />
            <RightNowRow icon="Armchair" text={place.right_now_seating} />
          </div>
        </div>

        {place.children && place.children.length > 0 && (
          <div className="mt-6">
            <div className="text-[13px] font-semibold text-[var(--text-primary)] mb-2">
              Inside this place ({place.children.length})
            </div>
            <ul className="flex flex-col gap-1 rounded-2xl border border-[var(--surface-border)] bg-white p-2 shadow-card">
              {place.children.map((child) => {
                const childMeta = categoryMeta(child.category);
                return (
                  <li key={child.id}>
                    <Link
                      href={`/place/${child.id}`}
                      className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-sys-gray-6 transition"
                    >
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
                        style={{ background: childMeta.color }}
                      >
                        <Icon name={childMeta.icon} size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                          {child.name}
                          {child.brand && child.brand !== child.name && (
                            <span className="ml-1.5 text-[11px] font-normal text-[var(--text-tertiary)]">
                              · {child.brand}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)]">
                          {childMeta.label}
                        </div>
                      </div>
                      <Icon
                        name="ArrowRight"
                        size={12}
                        className="text-[var(--text-tertiary)]"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="mt-6">
          <div className="text-[13px] font-semibold text-[var(--text-primary)] mb-2">
            Noise by hour
          </div>
          <div className="rounded-2xl border border-[var(--surface-border)] bg-white p-3 shadow-card">
            <NoiseHeatmap place={place} />
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[13px] font-semibold text-[var(--text-primary)]">
              Reviews ({realReviewCount})
            </div>
            <button
              type="button"
              onClick={() => setAllReviewsOpen(true)}
              className="text-[12px] font-medium text-accent hover:underline"
            >
              See all reviews
            </button>
          </div>
          <ReviewList
            reviews={previewReviews}
            onPhotoTap={() => {
              // Tap a thumbnail in the inline preview → open All Reviews
              // sheet pre-filtered to "With photos" so the user can scan
              // the rest in one place. See #45.
              setAllReviewsInitiallyOnlyPhotos(true);
              setAllReviewsOpen(true);
            }}
          />
        </div>

        <button
          type="button"
          onClick={() => setReviewMode(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--surface-border)] bg-white px-4 py-3 text-[13px] font-semibold text-[var(--text-primary)] hover:bg-sys-gray-6 transition"
        >
          <Icon name="PencilSimple" size={16} />
          <span>Leave a review</span>
        </button>

        <Link
          href={`/place/${place.id}/claim`}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--surface-border)] bg-transparent px-4 py-2.5 text-[12px] font-medium text-[var(--text-secondary)] hover:bg-sys-gray-6 transition"
        >
          <Icon name="Storefront" size={14} />
          <span>Own this place? Claim it</span>
        </Link>
      </div>

      <AllReviewsSheet
        place={place}
        reviews={allReviews}
        open={allReviewsOpen}
        onOpenChange={(o) => {
          setAllReviewsOpen(o);
          if (!o) setAllReviewsInitiallyOnlyPhotos(false);
        }}
        initiallyOnlyPhotos={allReviewsInitiallyOnlyPhotos}
      />
      <LiveUpdateSheet
        place={liveUpdateOpen ? place : null}
        open={liveUpdateOpen}
        onOpenChange={setLiveUpdateOpen}
      />
      <MenuSheet
        open={menuOpen}
        onOpenChange={setMenuOpen}
        placeName={place.name}
        menus={menus}
      />
    </div>
  );
}

interface DbReview {
  id: string;
  overall_rating: number | null;
  wifi_rating: number | null;
  noise_rating: number | null;
  seating_rating: number | null;
  comment: string | null;
  geo_verified: boolean;
  created_at: string;
  users: { display_name: string | null } | null;
  review_photos:
    | {
        slot: string;
        cloudinary_public_id: string;
        cloudinary_version: string | null;
        width: number | null;
        height: number | null;
      }[]
    | null;
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function initialsFor(name: string | null | undefined): string {
  if (!name) return '··';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const ALLOWED_PHOTO_SLOTS = new Set(['menu', 'inside', 'outside', 'special', 'coffee']);

function mapDbReviewToDemoShape(raw: unknown): DemoReview {
  const r = raw as DbReview;
  const author = r.users?.display_name ?? 'Anonymous';
  // Reviews now use the 1–10 scale; legacy 1–5 rows still read as 1–5 (lower
  // half of the new range). The DemoReview shape expects 1–5 — squish 1–10
  // back down for display until the demo type is widened.
  const squish = (v: number | null) => (v == null ? undefined : Math.max(1, Math.round(v / 2)));
  const photos = (r.review_photos ?? [])
    .filter((p) => ALLOWED_PHOTO_SLOTS.has(p.slot))
    .map((p) => ({
      slot: p.slot as ReviewPhoto['slot'],
      publicId: p.cloudinary_public_id,
      version: p.cloudinary_version,
      width: p.width,
      height: p.height,
    }));
  return {
    id: r.id,
    author,
    initials: initialsFor(author),
    trust: 50,
    rating: squish(r.overall_rating) ?? 3,
    wifi: squish(r.wifi_rating),
    noise: squish(r.noise_rating),
    seating: squish(r.seating_rating),
    comment: r.comment ?? '',
    createdAgo: relativeTime(r.created_at),
    geoVerified: r.geo_verified,
    photos: photos.length > 0 ? photos : undefined,
  };
}

function ChipButton({
  icon,
  label,
  onClick,
  href,
  iconWeight,
  highlighted,
}: {
  icon: PhosphorIconName;
  label: string;
  onClick?: () => void;
  href?: string;
  iconWeight?: 'regular' | 'fill';
  highlighted?: boolean;
}) {
  const className = `flex-1 flex items-center justify-center gap-1.5 rounded-2xl border border-[var(--surface-border)] py-2.5 text-[13px] font-medium transition ${
    highlighted
      ? 'bg-accent-red-tint text-accent-red'
      : 'bg-white/70 text-[var(--text-primary)] hover:bg-sys-gray-6'
  }`;
  const content = (
    <>
      <Icon name={icon} size={16} weight={iconWeight ?? 'regular'} />
      <span>{label}</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

function RightNowRow({ icon, text }: { icon: PhosphorIconName; text: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon name={icon} size={20} className="text-[var(--text-secondary)] shrink-0" />
      <div className="text-[14px] text-[var(--text-primary)]">{text}</div>
    </div>
  );
}

