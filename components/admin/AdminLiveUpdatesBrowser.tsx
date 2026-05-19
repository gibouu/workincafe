'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { LiveUpdateRow, type LiveUpdateRecord } from './LiveUpdateRow';

interface ListResponse {
  updates: LiveUpdateRecord[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 50;

export function AdminLiveUpdatesBrowser() {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [placeId, setPlaceId] = useState('');
  const [userId, setUserId] = useState('');
  const [includeDemo, setIncludeDemo] = useState(false);
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
  }, [debouncedQ, placeId, userId, includeDemo]);

  useEffect(() => {
    if (inflight.current) inflight.current.abort();
    const ctrl = new AbortController();
    inflight.current = ctrl;
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (debouncedQ) params.set('q', debouncedQ);
    if (placeId) params.set('place_id', placeId);
    if (userId) params.set('user_id', userId);
    if (includeDemo) params.set('include_demo', '1');
    // Data-fetch effect: loading/error flags synced before the request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    fetch(`/api/admin/live-updates?${params.toString()}`, { signal: ctrl.signal })
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
  }, [debouncedQ, placeId, userId, includeDemo, page]);

  const totalPages = useMemo(() => {
    if (!data) return 0;
    return Math.ceil(data.total / PAGE_SIZE);
  }, [data]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl bg-white border border-(--surface-border) px-3 py-2 shadow-card">
          <Icon name="MagnifyingGlass" size={16} className="text-(--text-secondary)" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search rotating answers"
            className="flex-1 bg-transparent text-[14px] text-(--text-primary) placeholder:text-(--text-tertiary) focus:outline-hidden"
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
          className="w-44 rounded-xl border border-(--surface-border) bg-white px-3 py-2 text-[13px] text-(--text-primary) placeholder:text-(--text-tertiary) shadow-card focus:outline-hidden"
        />
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="User ID (uuid)"
          className="w-44 rounded-xl border border-(--surface-border) bg-white px-3 py-2 text-[13px] text-(--text-primary) placeholder:text-(--text-tertiary) shadow-card focus:outline-hidden"
        />
        <label className="flex items-center gap-1.5 rounded-xl border border-(--surface-border) bg-white px-3 py-2 text-[13px] text-(--text-secondary) shadow-card">
          <input
            type="checkbox"
            checked={includeDemo}
            onChange={(e) => setIncludeDemo(e.target.checked)}
          />
          Include demo
        </label>
      </div>

      <div className="mt-3 text-[12px] text-(--text-secondary)">
        {loading ? 'Loading…' : data ? `${data.total.toLocaleString()} live updates` : ''}
        {error && <span className="ml-2 text-accent-red">· {error}</span>}
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {(data?.updates ?? []).map((u) => (
          <LiveUpdateRow key={u.id} update={u} />
        ))}
      </ul>

      {data && data.total === 0 && !loading && (
        <div className="mt-4 rounded-2xl border border-(--surface-border) bg-white p-6 text-center text-[13px] text-(--text-secondary)">
          No live updates match these filters.
        </div>
      )}

      {data && data.total > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
            className="rounded-xl border border-(--surface-border) bg-white px-3 py-1.5 text-[13px] font-semibold text-(--text-primary) hover:bg-sys-gray-6 disabled:opacity-50 transition"
          >
            Previous
          </button>
          <div className="text-[13px] text-(--text-secondary)">
            Page {page + 1} / {Math.max(1, totalPages)}
          </div>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={page + 1 >= totalPages || loading}
            className="rounded-xl border border-(--surface-border) bg-white px-3 py-1.5 text-[13px] font-semibold text-(--text-primary) hover:bg-sys-gray-6 disabled:opacity-50 transition"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
