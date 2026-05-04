'use client';

import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { type DemoPlace } from '@/lib/demo/paris-places';
import { categoryMeta } from '@/lib/categories';
import { brandLogoFor } from '@/lib/brand-logos';
import { CitySwitcher } from '@/components/layout/CitySwitcher';
import { useCity, CITIES } from '@/lib/store/city';

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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

export function PlaceSidebar({
  places,
  selectedId,
  onSelect,
  onOpenFilter,
  filterCount = 0,
}: {
  places: DemoPlace[];
  selectedId: string | null;
  onSelect: (place: DemoPlace) => void;
  onOpenFilter?: () => void;
  filterCount?: number;
}) {
  const [query, setQuery] = useState('');
  const city = useCity((s) => s.city);
  const cityLabel = CITIES[city].label;

  // Server-side search hits the full DB (not just the in-memory 2,500
  // alphabetical slice). Falls back to in-memory filter when the query
  // is empty or the API errors.
  const [searchHits, setSearchHits] = useState<DemoPlace[] | null>(null);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSearchHits(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      const url = `/api/places/search?city=${encodeURIComponent(cityLabel)}&q=${encodeURIComponent(q)}&limit=25`;
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
            wifi: 'moderate',
            noise: 'moderate',
            outlets: 'some',
            seats: 'some',
            lighting: 'good',
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
  }, [query, cityLabel]);

  const shownPlaces = useMemo(() => {
    if (searchHits) return searchHits;
    const q = normalize(query.trim());
    if (!q) return places;
    return places.filter(
      (p) => normalize(p.name).includes(q) || normalize(p.address).includes(q),
    );
  }, [places, query, searchHits]);

  return (
    <aside className="hidden md:flex h-full w-[320px] shrink-0 flex-col border-r border-[var(--surface-border)] bg-white/70 backdrop-blur-ios">
      <div className="flex items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-2">
          <Icon name="Coffee" weight="fill" size={22} className="text-[var(--text-primary)]" />
          <div className="text-[17px] font-semibold text-[var(--text-primary)]">Work in Cafe</div>
        </div>
        <CitySwitcher />
      </div>

      <div className="mt-4 flex items-center gap-2 px-5">
        <div className="flex flex-1 items-center gap-2 rounded-xl bg-sys-gray-6 px-3 py-2">
          <Icon name="MagnifyingGlass" size={16} className="text-[var(--text-secondary)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search places"
            className="flex-1 bg-transparent text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
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
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--surface-border)] bg-white text-[var(--text-primary)] hover:bg-sys-gray-6 transition"
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

      <div className="mt-3 flex-1 overflow-y-auto px-2 pb-4">
        {shownPlaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 text-center">
            <Icon name="MagnifyingGlass" size={32} className="text-sys-gray-3 mb-2" />
            <div className="text-[13px] text-[var(--text-secondary)]">
              No places match your filters
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
                />
              </li>
            ))}
          </ul>
        )}
      </div>

    </aside>
  );
}

function PlaceRow({
  place,
  selected,
  onClick,
}: {
  place: DemoPlace;
  selected: boolean;
  onClick: () => void;
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
            selected ? 'text-accent' : 'text-[var(--text-primary)]'
          }`}
        >
          {place.name}
        </div>
        <div className="mt-0.5 truncate text-[12px] text-[var(--text-secondary)]">
          {place.address} · {place.neighborhood}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[13px] font-semibold text-[var(--text-primary)]">
          {place.review_count > 0 ? place.rating.toFixed(1) : '—'}
        </div>
        <div className="text-[10px] text-[var(--text-secondary)]">
          {place.review_count > 0 ? `${place.review_count} rev` : 'No reviews'}
        </div>
      </div>
    </button>
  );
}
