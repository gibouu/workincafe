'use client';

import { useEffect, useMemo, useState } from 'react';
import { Drawer } from 'vaul';
import { Icon } from '@/components/icons/Icon';
import { ReviewList } from '@/components/review/ReviewList';
import { mapDbReviewToDemoShape } from '@/lib/review/db-review';
import type { DemoPlace } from '@/lib/demo/paris-places';
import type { DemoReview } from '@/lib/demo/reviews';

type SortKey = 'newest' | 'top' | 'low' | 'verified';
type Segment = 'visitors' | 'imported';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'top', label: 'Highest rated' },
  { value: 'low', label: 'Lowest rated' },
  { value: 'verified', label: 'Verified first' },
];

// Best-effort age parser: "2d ago" -> 2 days, "1w ago" -> 7 days, etc.
function ageDays(createdAgo: string): number {
  const m = createdAgo.match(/(\d+)\s*(d|w|h|m)/i);
  if (!m) return 999;
  const n = Number(m[1]);
  switch (m[2].toLowerCase()) {
    case 'h':
      return n / 24;
    case 'd':
      return n;
    case 'w':
      return n * 7;
    case 'm':
      return n * 30;
    default:
      return n;
  }
}

export function AllReviewsSheet({
  place,
  reviews,
  open,
  onOpenChange,
  initiallyOnlyPhotos = false,
}: {
  place: DemoPlace;
  reviews: DemoReview[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preselect the "With photos" filter chip — used when the sheet is opened
   *  by tapping a photo thumbnail (issue #16). */
  initiallyOnlyPhotos?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [onlyWithPhotos, setOnlyWithPhotos] = useState(initiallyOnlyPhotos);
  const [segment, setSegment] = useState<Segment>('visitors');

  // Imported (Yelp / Foursquare / Google / system) reviews are fetched lazily
  // the first time the user switches to that segment — the common path (user
  // reviews, passed in via props) costs no extra request. null = not fetched.
  const [imported, setImported] = useState<DemoReview[] | null>(null);
  const [importedLoading, setImportedLoading] = useState(false);

  // Re-sync the preset + segment each time the sheet opens. Deliberate
  // prop→state reset on an open transition — an effect is the right tool.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOnlyWithPhotos(initiallyOnlyPhotos);
      setSegment('visitors');
    }
  }, [open, initiallyOnlyPhotos]);

  useEffect(() => {
    if (!open || segment !== 'imported' || imported !== null || importedLoading) return;
    let aborted = false;
    // Lazy data-fetch effect: loading flag synced before the request, then
    // results fill in async — correct external sync, not a render cascade (#174).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setImportedLoading(true);
    fetch(`/api/places/${encodeURIComponent(place.id)}/reviews?source=imported&limit=50`)
      .then((r) => (r.ok ? r.json() : { reviews: [] }))
      .then((body: { reviews?: unknown[] }) => {
        if (aborted) return;
        setImported((body.reviews ?? []).map(mapDbReviewToDemoShape));
      })
      .catch(() => {
        if (!aborted) setImported([]);
      })
      .finally(() => {
        if (!aborted) setImportedLoading(false);
      });
    return () => {
      aborted = true;
    };
  }, [open, segment, imported, importedLoading, place.id]);

  const sourceList = useMemo(
    () => (segment === 'visitors' ? reviews : (imported ?? [])),
    [segment, reviews, imported],
  );

  const photoCount = useMemo(
    () => sourceList.filter((r) => r.photos && r.photos.length > 0).length,
    [sourceList],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? sourceList.filter(
          (r) => r.comment.toLowerCase().includes(q) || r.author.toLowerCase().includes(q),
        )
      : sourceList;
    const list = onlyWithPhotos ? base.filter((r) => r.photos && r.photos.length > 0) : base;
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sort) {
        case 'newest':
          return ageDays(a.createdAgo) - ageDays(b.createdAgo);
        case 'top':
          return b.rating - a.rating;
        case 'low':
          return a.rating - b.rating;
        case 'verified':
          return Number(b.geoVerified) - Number(a.geoVerified);
      }
    });
    return sorted;
  }, [sourceList, query, sort, onlyWithPhotos]);

  const SEGMENTS: { value: Segment; label: string }[] = [
    { value: 'visitors', label: `From visitors${reviews.length ? ` · ${reviews.length}` : ''}` },
    {
      value: 'imported',
      label: `Imported${imported && imported.length ? ` · ${imported.length}` : ''}`,
    },
  ];

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-60 bg-black/30" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-70 mx-auto flex h-[96dvh] max-w-2xl flex-col rounded-t-3xl bg-(--map-bg) shadow-float outline-hidden">
          <Drawer.Title className="sr-only">All reviews — {place.name}</Drawer.Title>
          <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-sys-gray-4" />

          <div className="flex items-start justify-between gap-3 px-5 pt-3">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-(--text-secondary)">
                Reviews
              </div>
              <div className="truncate text-[17px] font-semibold text-(--text-primary)">
                {place.name}
              </div>
              <div className="text-[11px] text-(--text-tertiary)">
                {filtered.length} of {sourceList.length} shown
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sys-gray-6 text-(--text-secondary) hover:bg-sys-gray-5 transition"
            >
              <Icon name="X" size={14} />
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-2 px-5">
            <div className="flex gap-1 rounded-xl bg-sys-gray-6 p-1">
              {SEGMENTS.map((seg) => {
                const active = segment === seg.value;
                return (
                  <button
                    key={seg.value}
                    type="button"
                    onClick={() => setSegment(seg.value)}
                    aria-pressed={active}
                    className={`flex-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
                      active
                        ? 'bg-white text-(--text-primary) shadow-card'
                        : 'text-(--text-secondary) hover:text-(--text-primary)'
                    }`}
                  >
                    {seg.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 border border-(--surface-border)">
              <Icon name="MagnifyingGlass" size={16} className="text-(--text-secondary)" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search reviews"
                className="flex-1 bg-transparent text-[14px] text-(--text-primary) placeholder:text-(--text-tertiary) focus:outline-hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-sys-gray-4 text-white"
                >
                  <Icon name="X" size={10} />
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SORT_OPTIONS.map((opt) => {
                const active = sort === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSort(opt.value)}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                      active
                        ? 'bg-(--text-primary) text-white'
                        : 'bg-white text-(--text-secondary) border border-(--surface-border) hover:bg-sys-gray-6'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
              {photoCount > 0 && (
                <button
                  type="button"
                  onClick={() => setOnlyWithPhotos((p) => !p)}
                  aria-pressed={onlyWithPhotos}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                    onlyWithPhotos
                      ? 'bg-accent text-white'
                      : 'bg-white text-(--text-secondary) border border-(--surface-border) hover:bg-sys-gray-6'
                  }`}
                >
                  <Icon name="Camera" size={12} weight={onlyWithPhotos ? 'fill' : 'regular'} />
                  <span>With photos · {photoCount}</span>
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-5 pb-6">
            {segment === 'imported' && (importedLoading || imported === null) ? (
              <div className="rounded-2xl border border-(--surface-border) bg-white p-6 text-center text-[13px] text-(--text-secondary)">
                Loading imported reviews…
              </div>
            ) : segment === 'imported' && sourceList.length === 0 ? (
              <div className="rounded-2xl border border-(--surface-border) bg-white p-6 text-center text-[13px] text-(--text-secondary)">
                No imported reviews for this place.
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-(--surface-border) bg-white p-6 text-center text-[13px] text-(--text-secondary)">
                No reviews match your search.
              </div>
            ) : (
              <>
                {segment === 'imported' && (
                  <p className="mb-3 rounded-xl bg-sys-gray-6 px-3 py-2 text-[11px] leading-relaxed text-(--text-secondary)">
                    Imported from third-party sources to give early signal. They
                    carry less weight than verified visitor reviews.
                  </p>
                )}
                <ReviewList reviews={filtered} />
              </>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
