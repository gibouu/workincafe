'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { AdminReviewRow, type AdminReviewRecord } from './AdminReviewRow';

interface ListResponse {
  reviews: AdminReviewRecord[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 50;

type StatusFilter = 'all' | 'visible' | 'hidden';

export function AdminReviewsBrowser() {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [placeId, setPlaceId] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef<AbortController | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  // Reset to page 0 whenever filters change. Deliberate cross-field reset
  // driven by several independent inputs — cleanest as an effect.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(0);
  }, [debouncedQ, placeId, userEmail, status]);

  useEffect(() => {
    if (inflight.current) inflight.current.abort();
    const ctrl = new AbortController();
    inflight.current = ctrl;
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      status,
    });
    if (debouncedQ) params.set('q', debouncedQ);
    if (placeId) params.set('place_id', placeId);
    // Note: API expects user_id (uuid) — if the operator typed an email,
    // they need to look up the id separately. The field is labelled clearly.
    if (userEmail && /^[0-9a-f-]{36}$/i.test(userEmail)) params.set('user_id', userEmail);
    // Data-fetch effect: loading/error flags synced before the request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    fetch(`/api/admin/reviews?${params.toString()}`, { signal: ctrl.signal })
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
  }, [debouncedQ, placeId, userEmail, status, page]);

  const handleDeleted = (id: string) => {
    setData((d) =>
      d
        ? {
            ...d,
            reviews: d.reviews.filter((r) => r.id !== id),
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
            placeholder="Search review text"
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
          value={placeId}
          onChange={(e) => setPlaceId(e.target.value)}
          placeholder="Place ID (uuid)"
          className="w-44 rounded-xl border border-[var(--surface-border)] bg-white px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] shadow-card focus:outline-none"
        />
        <input
          value={userEmail}
          onChange={(e) => setUserEmail(e.target.value)}
          placeholder="User ID (uuid)"
          className="w-44 rounded-xl border border-[var(--surface-border)] bg-white px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] shadow-card focus:outline-none"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="rounded-xl border border-[var(--surface-border)] bg-white px-3 py-2 text-[14px] text-[var(--text-primary)] shadow-card focus:outline-none"
        >
          <option value="all">All</option>
          <option value="visible">Visible only</option>
          <option value="hidden">Hidden only</option>
        </select>
      </div>

      <div className="mt-3 text-[12px] text-[var(--text-secondary)]">
        {loading ? 'Loading…' : data ? `${data.total.toLocaleString()} reviews` : ''}
        {error && (
          <span className="ml-2 text-accent-red">· {error}</span>
        )}
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {(data?.reviews ?? []).map((r) => (
          <AdminReviewRow key={r.id} review={r} onDeleted={handleDeleted} />
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
