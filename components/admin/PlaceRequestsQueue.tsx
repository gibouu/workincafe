'use client';

import { useMemo, useState } from 'react';
import { PlaceRequestRow, type PlaceRequestRecord } from '@/components/admin/PlaceRequestRow';
import { REJECT_REASON_PRESETS } from '@/lib/admin/reject-reasons';

const MAX_BATCH = 50;

interface BulkResponse {
  ok: boolean;
  processed: string[];
  skipped: { id: string; reason: string }[];
  processedCount: number;
  skippedCount: number;
}

export function PlaceRequestsQueue({ requests }: { requests: PlaceRequestRecord[] }) {
  const [items, setItems] = useState<PlaceRequestRecord[]>(requests);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState('');
  const [otherMode, setOtherMode] = useState(false);

  const selectedIds = useMemo(
    () => items.filter((r) => selected.has(r.id)).map((r) => r.id),
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
    setSelected(allSelected ? new Set() : new Set(items.slice(0, MAX_BATCH).map((r) => r.id)));

  const resetBulkUi = () => {
    setRejectMode(false);
    setOtherMode(false);
    setReason('');
  };

  const runBulk = async (decision: 'approved' | 'rejected') => {
    const ids = selectedIds.slice(0, MAX_BATCH);
    if (ids.length === 0) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const resp = await fetch('/api/admin/place-requests/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ids,
          decision,
          rejection_reason: decision === 'rejected' ? reason.trim() || undefined : undefined,
        }),
      });
      if (!resp.ok) {
        const body = (await resp.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `request failed (${resp.status})`);
      }
      const body = (await resp.json()) as BulkResponse;
      const done = new Set(body.processed);
      setItems((prev) => prev.filter((r) => !done.has(r.id)));
      setSelected(new Set());
      resetBulkUi();
      setNote(
        `${body.processedCount} ${decision}` +
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
        {note ?? 'Nothing pending. New submissions from the Add-a-place wizard land here.'}
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
        {items.map((r) => (
          <PlaceRequestRow
            key={r.id}
            req={r}
            leading={
              <input
                type="checkbox"
                checked={selected.has(r.id)}
                onChange={() => toggle(r.id)}
                aria-label={`Select ${r.name}`}
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
            {!rejectMode ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => runBulk('approved')}
                  disabled={busy}
                  className="rounded-xl bg-accent-green px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-60 transition"
                >
                  {busy ? 'Working…' : `Approve ${selectedIds.length}`}
                </button>
                <button
                  type="button"
                  onClick={() => setRejectMode(true)}
                  disabled={busy}
                  className="rounded-xl bg-accent-red px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-60 transition"
                >
                  Reject {selectedIds.length}
                </button>
              </div>
            ) : null}
          </div>

          {rejectMode && (
            <div className="mt-3 flex flex-col gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-(--text-secondary)">
                Reason for all {selectedIds.length}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {REJECT_REASON_PRESETS.map((preset) => {
                  const active = !otherMode && reason === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setOtherMode(false);
                        setReason(preset);
                      }}
                      disabled={busy}
                      className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition disabled:opacity-60 ${
                        active
                          ? 'bg-(--text-primary) text-white'
                          : 'bg-white text-(--text-secondary) border border-(--surface-border) hover:bg-sys-gray-6'
                      }`}
                    >
                      {preset}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setOtherMode(true);
                    setReason('');
                  }}
                  disabled={busy}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition disabled:opacity-60 ${
                    otherMode
                      ? 'bg-(--text-primary) text-white'
                      : 'bg-white text-(--text-secondary) border border-(--surface-border) hover:bg-sys-gray-6'
                  }`}
                >
                  Other
                </button>
              </div>
              {otherMode && (
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value.slice(0, 280))}
                  placeholder="Why? (applies to every selected request)"
                  rows={2}
                  autoFocus
                  className="w-full resize-none rounded-xl border border-(--surface-border) bg-(--map-bg) px-3 py-2 text-[13px] text-(--text-primary) placeholder:text-(--text-tertiary) focus:outline-hidden focus:ring-2 focus:ring-accent"
                />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetBulkUi}
                  disabled={busy}
                  className="flex-1 rounded-xl border border-(--surface-border) bg-white py-2 text-[13px] font-semibold text-(--text-primary) hover:bg-sys-gray-6 disabled:opacity-60 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => runBulk('rejected')}
                  disabled={busy}
                  className="flex-1 rounded-xl bg-accent-red py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-60 transition"
                >
                  {busy ? 'Rejecting…' : `Confirm reject ${selectedIds.length}`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
