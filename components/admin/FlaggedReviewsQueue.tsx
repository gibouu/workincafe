'use client';

import { useMemo, useState } from 'react';
import { FlaggedReviewRow, type FlaggedReviewRecord } from '@/components/admin/FlaggedReviewRow';

const MAX_BATCH = 50;

interface BulkResponse {
  ok: boolean;
  processed: string[];
  skipped: { id: string; reason: string }[];
  processedCount: number;
  skippedCount: number;
}

export function FlaggedReviewsQueue({ flagged }: { flagged: FlaggedReviewRecord[] }) {
  const [items, setItems] = useState<FlaggedReviewRecord[]>(flagged);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [hideMode, setHideMode] = useState(false);
  const [reason, setReason] = useState('');

  const selectedIds = useMemo(
    () => items.filter((f) => selected.has(f.id)).map((f) => f.id),
    [items, selected],
  );
  const allSelected = items.length > 0 && selectedIds.length === items.length;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(items.slice(0, MAX_BATCH).map((f) => f.id)));

  const runBulk = async (decision: 'dismiss' | 'hide') => {
    const ids = selectedIds.slice(0, MAX_BATCH);
    if (ids.length === 0) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const resp = await fetch('/api/admin/flagged-reviews/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ids,
          decision,
          reason: decision === 'hide' ? reason.trim() || undefined : undefined,
        }),
      });
      if (!resp.ok) {
        const body = (await resp.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `request failed (${resp.status})`);
      }
      const body = (await resp.json()) as BulkResponse;
      const done = new Set(body.processed);
      setItems((prev) => prev.filter((f) => !done.has(f.id)));
      setSelected(new Set());
      setHideMode(false);
      setReason('');
      setNote(
        `${body.processedCount} ${decision === 'dismiss' ? 'dismissed' : 'hidden'}` +
          (body.skippedCount > 0 ? ` · ${body.skippedCount} skipped` : ''),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk action failed');
    } finally {
      setBusy(false);
    }
  };

  if (items.length === 0) {
    return (
      <p className="mt-1 text-[14px] text-(--text-secondary)">
        {note ?? 'Nothing flagged. Reports from users land here.'}
      </p>
    );
  }

  return (
    <div>
      <div className="mt-1 flex flex-wrap items-center gap-3 text-[14px] text-(--text-secondary)">
        <span>{items.length} pending</span>
        <button
          type="button"
          onClick={toggleAll}
          className="rounded-full border border-(--surface-border) bg-white px-3 py-1 text-[12px] font-medium text-(--text-secondary) hover:bg-sys-gray-6 transition"
        >
          {allSelected ? 'Clear selection' : `Select all (max ${MAX_BATCH})`}
        </button>
        {note && <span className="text-accent-green">{note}</span>}
        {error && <span className="text-accent-red">{error}</span>}
      </div>

      <ul className="mt-6 flex flex-col gap-3">
        {items.map((f) => (
          <FlaggedReviewRow
            key={f.id}
            flag={f}
            leading={
              <input
                type="checkbox"
                checked={selected.has(f.id)}
                onChange={() => toggle(f.id)}
                aria-label="Select flagged review"
                className="mt-1 h-4 w-4 shrink-0 accent-(--text-primary)"
              />
            }
          />
        ))}
      </ul>

      {selectedIds.length > 0 && (
        <div className="sticky bottom-3 mt-4 rounded-2xl border border-(--surface-border) bg-white/95 p-3 shadow-float backdrop-blur-ios">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[13px] font-semibold text-(--text-primary)">
              {selectedIds.length} selected
              {selectedIds.length >= MAX_BATCH && (
                <span className="ml-1 text-[11px] font-normal text-(--text-tertiary)">
                  (cap {MAX_BATCH})
                </span>
              )}
            </div>
            {!hideMode && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => runBulk('dismiss')}
                  disabled={busy}
                  className="rounded-xl border border-(--surface-border) bg-white px-4 py-2 text-[13px] font-semibold text-(--text-primary) hover:bg-sys-gray-6 disabled:opacity-60 transition"
                >
                  {busy ? 'Working…' : `Dismiss ${selectedIds.length}`}
                </button>
                <button
                  type="button"
                  onClick={() => setHideMode(true)}
                  disabled={busy}
                  className="rounded-xl bg-accent-red px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-60 transition"
                >
                  Hide {selectedIds.length}
                </button>
              </div>
            )}
          </div>

          {hideMode && (
            <div className="mt-3 flex flex-col gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-(--text-secondary)">
                Hide {selectedIds.length} review{selectedIds.length === 1 ? '' : 's'} — optional note
              </div>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 280))}
                placeholder="Why? (recorded on every selected flag; authors are NOT banned)"
                rows={2}
                autoFocus
                className="w-full resize-none rounded-xl border border-(--surface-border) bg-(--map-bg) px-3 py-2 text-[13px] text-(--text-primary) placeholder:text-(--text-tertiary) focus:outline-hidden focus:ring-2 focus:ring-accent"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setHideMode(false);
                    setReason('');
                  }}
                  disabled={busy}
                  className="flex-1 rounded-xl border border-(--surface-border) bg-white py-2 text-[13px] font-semibold text-(--text-primary) hover:bg-sys-gray-6 disabled:opacity-60 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => runBulk('hide')}
                  disabled={busy}
                  className="flex-1 rounded-xl bg-accent-red py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-60 transition"
                >
                  {busy ? 'Hiding…' : `Confirm hide ${selectedIds.length}`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
