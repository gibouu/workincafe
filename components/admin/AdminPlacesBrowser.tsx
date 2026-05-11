'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { CATEGORIES, type PlaceCategory } from '@/lib/categories';
import { AdminPlaceRow, type AdminPlaceRecord } from './AdminPlaceRow';

interface ListResponse {
  places: AdminPlaceRecord[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 50;

export function AdminPlacesBrowser() {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [category, setCategory] = useState<PlaceCategory | ''>('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef<AbortController | null>(null);

  // Debounce typed search — 250ms feels responsive without hammering the API.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  // Reset to page 0 whenever filters change.
  useEffect(() => {
    setPage(0);
  }, [debouncedQ, city, country, category]);

  useEffect(() => {
    if (inflight.current) inflight.current.abort();
    const ctrl = new AbortController();
    inflight.current = ctrl;
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (debouncedQ) params.set('q', debouncedQ);
    if (city) params.set('city', city);
    if (country) params.set('country', country);
    if (category) params.set('category', category);
    setLoading(true);
    setError(null);
    fetch(`/api/admin/places?${params.toString()}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) {
          const body = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `request failed (${r.status})`);
        }
        return r.json() as Promise<ListResponse>;
      })
      .then((body) => {
        if (ctrl.signal.aborted) return;
        setData(body);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'fetch failed');
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
  }, [debouncedQ, city, country, category, page]);

  const handleDeleted = (id: string) => {
    setData((d) =>
      d
        ? {
            ...d,
            places: d.places.filter((p) => p.id !== id),
            total: Math.max(0, d.total - 1),
          }
        : d,
    );
  };

  const totalPages = useMemo(() => {
    if (!data) return 0;
    return Math.ceil(data.total / PAGE_SIZE);
  }, [data]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl bg-white border border-[var(--surface-border)] px-3 py-2 shadow-card">
          <Icon name="MagnifyingGlass" size={16} className="text-[var(--text-secondary)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name / address / brand"
            className="flex-1 bg-transparent text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-sys-gray-4 text-white"
              aria-label="Clear"
            >
              <Icon name="X" size={10} />
            </button>
          )}
        </div>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City"
          className="w-32 rounded-xl border border-[var(--surface-border)] bg-white px-3 py-2 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] shadow-card focus:outline-none"
        />
        <input
          value={country}
          onChange={(e) => setCountry(e.target.value.toUpperCase())}
          placeholder="Country"
          maxLength={2}
          className="w-24 rounded-xl border border-[var(--surface-border)] bg-white px-3 py-2 text-[14px] uppercase text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] shadow-card focus:outline-none"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as PlaceCategory | '')}
          className="rounded-xl border border-[var(--surface-border)] bg-white px-3 py-2 text-[14px] text-[var(--text-primary)] shadow-card focus:outline-none"
        >
          <option value="">All categories</option>
          {(Object.keys(CATEGORIES) as PlaceCategory[]).map((k) => (
            <option key={k} value={k}>
              {CATEGORIES[k].label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 text-[12px] text-[var(--text-secondary)]">
        {loading ? 'Loading…' : data ? `${data.total.toLocaleString()} results` : ''}
        {error && (
          <span className="ml-2 text-accent-red">· {error}</span>
        )}
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {(data?.places ?? []).map((p) => (
          <AdminPlaceRow key={p.id} place={p} onDeleted={handleDeleted} />
        ))}
      </ul>

      {data && data.total > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
            className="rounded-xl border border-[var(--surface-border)] bg-white px-3 py-1.5 text-[13px] font-semibold text-[var(--text-primary)] hover:bg-sys-gray-6 disabled:opacity-50 transition"
          >
            Previous
          </button>
          <div className="text-[13px] text-[var(--text-secondary)]">
            Page {page + 1} / {Math.max(1, totalPages)}
          </div>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={page + 1 >= totalPages || loading}
            className="rounded-xl border border-[var(--surface-border)] bg-white px-3 py-1.5 text-[13px] font-semibold text-[var(--text-primary)] hover:bg-sys-gray-6 disabled:opacity-50 transition"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
