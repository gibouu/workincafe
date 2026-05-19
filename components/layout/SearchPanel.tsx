'use client';

import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import type { PhosphorIconName } from '@/components/icons/Icon';
import { type DemoPlace } from '@/lib/demo/paris-places';
import { categoryMeta } from '@/lib/categories';
import { brandLogoFor } from '@/lib/brand-logos';
import { haversineKm } from '@/lib/geo/distance';

export interface SidebarAnchor {
  label: string;
  lat: number;
  lng: number;
  /** Optional target zoom level. Address picks zoom in close enough to
   *  see cafés in the immediate area; neighborhoods / landmarks leave
   *  zoom unchanged so the user keeps their context. */
  zoom?: number;
}

interface LocationHit {
  kind: 'address' | 'neighborhood' | 'park' | 'street' | 'landmark';
  label: string;
  subLabel: string | null;
  lat: number;
  lng: number;
}

const KIND_ICON: Record<LocationHit['kind'], PhosphorIconName> = {
  address: 'House',
  neighborhood: 'MapPin',
  park: 'Tree',
  street: 'NavigationArrow',
  landmark: 'Star',
};

// Zoom level the map flies to when the user picks each kind. Addresses
// zoom close enough to see café markers in the immediate block;
// neighborhoods and bigger landmarks leave zoom unchanged (undefined).
const KIND_ZOOM: Partial<Record<LocationHit['kind'], number>> = {
  address: 16,
  street: 15,
  landmark: 15,
};

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

interface SearchHit {
  id: string;
  name: string;
  address: string | null;
  neighborhood: string | null;
  category: DemoPlace['category'];
  brand: string | null;
  lat: number;
  lng: number;
}

/**
 * Shared search UI — used by both the desktop sidebar and the mobile
 * search drawer (#141). Owns query / search-hits / location-hits state
 * and renders the search input, locations dropdown, anchor pill, and
 * filtered place list.
 *
 * Parents own anchor + selected place state and pass them in.
 */
export function SearchPanel({
  places,
  selectedId,
  onSelect,
  onOpenFilter,
  filterCount = 0,
  anchor,
  onSetAnchor,
  onClearAnchor,
  viewport,
  autoFocus = false,
}: {
  places: DemoPlace[];
  selectedId: string | null;
  onSelect: (place: DemoPlace) => void;
  onOpenFilter?: () => void;
  filterCount?: number;
  anchor?: SidebarAnchor | null;
  onSetAnchor?: (anchor: SidebarAnchor) => void;
  onClearAnchor?: () => void;
  viewport?: {
    bbox: [number, number, number, number];
    center: { lat: number; lng: number };
  } | null;
  /** Auto-focus the search input on mount. Useful for the mobile drawer
   *  so the keyboard pops up immediately when it opens. */
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState('');
  const bboxParam = viewport ? viewport.bbox.join(',') : '';
  const centerLat = viewport?.center.lat ?? null;
  const centerLng = viewport?.center.lng ?? null;

  // Server-side place search — bbox-bounded to the current viewport so
  // the same query "Anticafé" returns a Paris hit when looking at Paris
  // and a Toronto hit when looking at Toronto.
  const [searchHits, setSearchHits] = useState<DemoPlace[] | null>(null);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      // Debounced-fetch effect: clearing stale hits on a too-short query
      // is the correct external sync, not a render-cascade bug.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchHits(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      const params = new URLSearchParams({ q, limit: '25' });
      if (bboxParam) params.set('bbox', bboxParam);
      const url = `/api/places/search?${params.toString()}`;
      fetch(url, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { places: [] }))
        .then((data: { places?: SearchHit[] }) => {
          const hits = (data.places ?? []).map<DemoPlace>((p) => ({
            id: p.id,
            name: p.name,
            address: p.address ?? '',
            neighborhood: p.neighborhood ?? '',
            category: p.category,
            lat: p.lat,
            lng: p.lng,
            brand: p.brand,
            rating: 0,
            review_count: 0,
            avg_spend_eur: 0,
            wifi: 'unknown',
            noise: 'unknown',
            outlets: 'unknown',
            seats: 'unknown',
            lighting: 'unknown',
            tabletime_hours: 0,
            right_now_noise: 'No recent live updates',
            right_now_seating: 'No recent live updates',
          }));
          setSearchHits(hits);
        })
        .catch(() => null);
    }, 200);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query, bboxParam]);

  // Locations search — runs in parallel with the place search above.
  // Hits /api/geocode (Photon proxy) bbox-bounded to the current viewport.
  const [locationHits, setLocationHits] = useState<LocationHit[]>([]);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      // Debounced-fetch effect: clearing stale hits on a too-short query
      // is the correct external sync, not a render-cascade bug.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocationHits([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      const params = new URLSearchParams({ q });
      if (bboxParam) params.set('bbox', bboxParam);
      if (centerLat !== null && centerLng !== null) {
        params.set('lat', String(centerLat));
        params.set('lng', String(centerLng));
      }
      const url = `/api/geocode?${params.toString()}`;
      fetch(url, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((data: { results?: LocationHit[] }) => {
          setLocationHits(Array.isArray(data.results) ? data.results : []);
        })
        .catch(() => null);
    }, 200);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query, bboxParam, centerLat, centerLng]);

  const shownPlaces = useMemo(() => {
    const base = (() => {
      if (searchHits) return searchHits;
      const q = normalize(query.trim());
      if (!q) return places;
      return places.filter(
        (p) => normalize(p.name).includes(q) || normalize(p.address).includes(q),
      );
    })();
    if (anchor && !query.trim()) {
      return [...base]
        .map((p) => ({ p, d: haversineKm(anchor.lat, anchor.lng, p.lat, p.lng) }))
        .sort((a, b) => a.d - b.d)
        .map(({ p }) => p);
    }
    return base;
  }, [places, query, searchHits, anchor]);

  const handleLocationPick = (h: LocationHit) => {
    if (!onSetAnchor) return;
    onSetAnchor({ label: h.label, lat: h.lat, lng: h.lng, zoom: KIND_ZOOM[h.kind] });
    setQuery('');
    setLocationHits([]);
    setSearchHits(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 px-5 pt-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl bg-sys-gray-6 px-3 py-2">
          <Icon name="MagnifyingGlass" size={16} className="text-(--text-secondary)" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search places, addresses, neighborhoods"
            autoFocus={autoFocus}
            className="flex-1 bg-transparent text-[13px] text-(--text-primary) placeholder:text-(--text-tertiary) focus:outline-hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-sys-gray-4 text-white"
              aria-label="Clear"
            >
              <Icon name="X" size={10} />
            </button>
          )}
        </div>
        {onOpenFilter && (
          <button
            type="button"
            onClick={onOpenFilter}
            aria-label="Filter"
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-(--surface-border) bg-white text-(--text-primary) hover:bg-sys-gray-6 transition"
          >
            <Icon name="SlidersHorizontal" size={16} />
            {filterCount > 0 && (
              <span className="pointer-events-none absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
                {filterCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Locations dropdown — appears between the search input and the
          place list when the user is typing and Photon returned matches.
          Tap a location to set the anchor (#103, #120). */}
      {query.trim() && locationHits.length > 0 && (
        <div className="mt-2 mx-3 overflow-hidden rounded-xl border border-(--surface-border) bg-white shadow-card">
          <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-(--text-tertiary)">
            Locations
          </div>
          <ul className="flex flex-col">
            {locationHits.map((h, i) => (
              <li key={`${h.label}-${i}`}>
                <button
                  type="button"
                  onClick={() => handleLocationPick(h)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-sys-gray-6"
                >
                  <Icon name={KIND_ICON[h.kind]} size={16} className="text-accent" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-(--text-primary)">
                      {h.label}
                    </div>
                    {h.subLabel && (
                      <div className="truncate text-[11px] text-(--text-tertiary)">
                        {h.subLabel}
                      </div>
                    )}
                  </div>
                  <Icon name="ArrowRight" size={12} className="text-(--text-tertiary)" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Anchor bar — visible whenever an anchor is active (no query). */}
      {anchor && !query.trim() && (
        <div className="mt-2 mx-3 flex items-center gap-2 rounded-xl bg-accent-tint px-3 py-2 text-[12px]">
          <Icon name="MapPin" size={14} weight="fill" className="text-accent" />
          <div className="min-w-0 flex-1 truncate font-medium text-accent">
            Near {anchor.label}
          </div>
          {onClearAnchor && (
            <button
              type="button"
              onClick={onClearAnchor}
              className="text-[12px] font-medium text-accent underline-offset-2 hover:underline"
            >
              clear
            </button>
          )}
        </div>
      )}

      <div className="mt-3 flex-1 overflow-y-auto px-2 pb-4">
        {shownPlaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 text-center">
            <Icon name="MagnifyingGlass" size={32} className="text-sys-gray-3 mb-2" />
            <div className="text-[13px] text-(--text-secondary)">
              {query.trim() ? 'No places match' : 'Pan or zoom the map to see places'}
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {shownPlaces.map((place) => (
              <li key={place.id}>
                <PlaceRow
                  place={place}
                  selected={selectedId === place.id}
                  onClick={() => onSelect(place)}
                  anchor={anchor ?? null}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function formatKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function PlaceRow({
  place,
  selected,
  onClick,
  anchor,
}: {
  place: DemoPlace;
  selected: boolean;
  onClick: () => void;
  anchor: SidebarAnchor | null;
}) {
  const meta = categoryMeta(place.category);
  const brand = brandLogoFor(place.name);
  const bg = brand?.bg ?? meta.color;
  const fg = brand?.fg ?? '#fff';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
        selected ? 'bg-accent-tint' : 'hover:bg-sys-gray-6'
      }`}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-bubble"
        style={{ background: bg, color: fg }}
      >
        {brand ? (
          <span className={`font-bold tracking-tight ${brand.initials.length === 1 ? 'text-[15px]' : 'text-[11px]'}`}>
            {brand.initials}
          </span>
        ) : (
          <Icon name={meta.icon} size={18} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={`truncate text-[14px] font-semibold leading-tight ${
            selected ? 'text-accent' : 'text-(--text-primary)'
          }`}
        >
          {place.name}
        </div>
        <div className="mt-0.5 truncate text-[12px] text-(--text-secondary)">
          {[place.address, place.neighborhood].filter(Boolean).join(' · ') || '—'}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[13px] font-semibold text-(--text-primary)">
          {place.review_count > 0 || place.has_user_reviews ? place.rating.toFixed(1) : '—'}
        </div>
        {anchor ? (
          <div className="text-[10px] text-accent">
            {formatKm(haversineKm(anchor.lat, anchor.lng, place.lat, place.lng))}
          </div>
        ) : (
          <div className="text-[10px] text-(--text-tertiary)">/10</div>
        )}
      </div>
    </button>
  );
}
