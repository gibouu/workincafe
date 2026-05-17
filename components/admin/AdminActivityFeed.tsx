'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, type PhosphorIconName } from '@/components/icons/Icon';

interface ActivityEvent {
  id: string;
  kind: 'place_request' | 'flagged_review';
  action: string;
  target: string;
  detail: string | null;
  actor_email: string | null;
  actor_id: string | null;
  at: string;
}

interface ListResponse {
  events: ActivityEvent[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 50;

type KindFilter = 'all' | 'place_request' | 'flagged_review';

const KINDS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'place_request', label: 'Place requests' },
  { value: 'flagged_review', label: 'Flagged reviews' },
];

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const d = Math.floor(hr / 24);
  return `${d} d ago`;
}

function iconFor(action: string): { name: PhosphorIconName; tone: string } {
  switch (action) {
    case 'approved':
      return { name: 'CheckCircle', tone: 'text-accent-green' };
    case 'rejected':
    case 'dismiss':
      return { name: 'XCircle', tone: 'text-[var(--text-secondary)]' };
    case 'hide':
      return { name: 'EyeSlash', tone: 'text-accent-red' };
    case 'ban':
      return { name: 'Prohibit', tone: 'text-accent-red' };
    default:
      return { name: 'ClockCounterClockwise', tone: 'text-[var(--text-secondary)]' };
  }
}

export function AdminActivityFeed() {
  const [kind, setKind] = useState<KindFilter>('all');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef<AbortController | null>(null);

  // Reset to page 0 when the kind filter changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(0);
  }, [kind]);

  useEffect(() => {
    if (inflight.current) inflight.current.abort();
    const ctrl = new AbortController();
    inflight.current = ctrl;
    const params = new URLSearchParams({ kind, page: String(page), pageSize: String(PAGE_SIZE) });
    // Data-fetch effect: loading/error flags synced before the request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    fetch(`/api/admin/activity?${params.toString()}`, { signal: ctrl.signal })
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
  }, [kind, page]);

  const totalPages = useMemo(() => {
    if (!data) return 0;
    return Math.ceil(data.total / PAGE_SIZE);
  }, [data]);

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {KINDS.map((k) => {
          const active = kind === k.value;
          return (
            <button
              key={k.value}
              type="button"
              onClick={() => setKind(k.value)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                active
                  ? 'bg-[var(--text-primary)] text-white'
                  : 'bg-white text-[var(--text-secondary)] border border-[var(--surface-border)] hover:bg-sys-gray-6'
              }`}
            >
              {k.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 text-[12px] text-[var(--text-secondary)]">
        {loading ? 'Loading…' : data ? `${data.total.toLocaleString()} actions` : ''}
        {error && <span className="ml-2 text-accent-red">· {error}</span>}
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {(data?.events ?? []).map((e) => {
          const ic = iconFor(e.action);
          return (
            <li
              key={e.id}
              className="flex items-start gap-3 rounded-2xl border border-[var(--surface-border)] bg-white p-3 shadow-card"
            >
              <Icon name={ic.name} size={18} className={`mt-0.5 shrink-0 ${ic.tone}`} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-[var(--text-primary)]">
                  <span className="font-semibold">{e.action}</span> · {e.target}
                </div>
                <div className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
                  {e.actor_email ?? e.actor_id ?? 'unknown admin'} · {timeAgo(e.at)} ·{' '}
                  {e.kind === 'place_request' ? 'place request' : 'flagged review'}
                </div>
                {e.detail && (
                  <div className="mt-1 text-[12px] text-[var(--text-secondary)]">{e.detail}</div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {data && data.total === 0 && !loading && (
        <div className="mt-4 rounded-2xl border border-[var(--surface-border)] bg-white p-6 text-center text-[13px] text-[var(--text-secondary)]">
          No admin actions yet.
        </div>
      )}

      {data && data.total > PAGE_SIZE && (
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
