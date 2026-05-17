'use client';

import { useState, type ReactNode } from 'react';
import { Icon } from '@/components/icons/Icon';
import { categoryMeta } from '@/lib/categories';
import type { PlaceCategory } from '@/lib/categories';
import { REJECT_REASON_PRESETS } from '@/lib/admin/reject-reasons';

export interface PlaceRequestRecord {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  category_suggestion: string | null;
  notes: string | null;
  created_at: string;
  submitter_email: string | null;
  /** Submitter's historical approved / decided count (#167). null = no
   *  prior decided submissions. */
  submitter_stats: { approved: number; decided: number } | null;
}

function TrustBadge({ stats }: { stats: { approved: number; decided: number } }) {
  const ratio = stats.approved / stats.decided;
  const tone =
    ratio >= 0.7
      ? 'bg-accent-green-tint text-accent-green'
      : ratio <= 0.34
        ? 'bg-accent-red-tint text-accent-red'
        : 'bg-accent-amber-tint text-accent-amber';
  return (
    <span
      className={`ml-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tone}`}
      title={`${stats.approved} approved of ${stats.decided} decided submissions`}
    >
      {stats.approved}/{stats.decided} approved
    </span>
  );
}

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

export function PlaceRequestRow({
  req,
  leading,
}: {
  req: PlaceRequestRecord;
  /** Optional slot rendered at the row's top-left — used by the bulk-select
   *  queue wrapper to inject a checkbox without owning the row layout (#167). */
  leading?: ReactNode;
}) {
  const [pending, setPending] = useState<'approve' | 'reject' | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');
  // 'other' reveals the free-text box; a preset click fills `reason` directly.
  const [otherMode, setOtherMode] = useState(false);

  const resetReject = () => {
    setShowReject(false);
    setOtherMode(false);
    setReason('');
  };
  const meta = categoryMeta((req.category_suggestion as PlaceCategory) ?? 'other');

  if (done) {
    return (
      <li className="rounded-2xl border border-[var(--surface-border)] bg-white p-4 shadow-card">
        <div className="text-[13px] text-[var(--text-secondary)]">
          {req.name} — {done}
        </div>
      </li>
    );
  }

  const decide = async (decision: 'approved' | 'rejected') => {
    setPending(decision === 'approved' ? 'approve' : 'reject');
    setError(null);
    try {
      const resp = await fetch(`/api/admin/place-requests/${req.id}/decision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          decision,
          rejection_reason: decision === 'rejected' ? reason.trim() || undefined : undefined,
        }),
      });
      if (!resp.ok) {
        const body = (await resp.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `request failed (${resp.status})`);
      }
      setDone(decision === 'approved' ? 'approved · place added' : 'rejected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setPending(null);
    }
  };

  return (
    <li className="rounded-2xl border border-[var(--surface-border)] bg-white p-4 shadow-card">
      <div className="flex items-start gap-3">
        {leading}
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-bubble"
          style={{ background: meta.color }}
        >
          <Icon name={meta.icon} size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-[var(--text-primary)]">
            {req.name}
          </div>
          <div className="text-[12px] text-[var(--text-secondary)]">
            {meta.label}
            {req.address ? ` · ${req.address}` : ''} · submitted {timeAgo(req.created_at)}
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">
            {req.lat.toFixed(4)}, {req.lng.toFixed(4)}
            {req.submitter_email ? ` · by ${req.submitter_email}` : ''}
            {req.submitter_stats && req.submitter_stats.decided > 0 && (
              <TrustBadge stats={req.submitter_stats} />
            )}
          </div>
          {req.notes && (
            <div className="mt-2 whitespace-pre-wrap text-[13px] text-[var(--text-primary)]">
              {req.notes}
            </div>
          )}
        </div>
      </div>
      {error && (
        <div className="mt-3 rounded-xl bg-accent-red-tint p-2 text-center text-[12px] text-accent-red">
          {error}
        </div>
      )}
      {showReject ? (
        <div className="mt-3 flex flex-col gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Reason
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
                  disabled={pending !== null}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition disabled:opacity-60 ${
                    active
                      ? 'bg-[var(--text-primary)] text-white'
                      : 'bg-white text-[var(--text-secondary)] border border-[var(--surface-border)] hover:bg-sys-gray-6'
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
              disabled={pending !== null}
              className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition disabled:opacity-60 ${
                otherMode
                  ? 'bg-[var(--text-primary)] text-white'
                  : 'bg-white text-[var(--text-secondary)] border border-[var(--surface-border)] hover:bg-sys-gray-6'
              }`}
            >
              Other
            </button>
          </div>
          {otherMode && (
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 280))}
              placeholder="Why? (shown to the submitter when notifications ship)"
              rows={2}
              autoFocus
              className="w-full resize-none rounded-xl border border-[var(--surface-border)] bg-[var(--map-bg)] px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-accent"
            />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetReject}
              disabled={pending !== null}
              className="flex-1 rounded-xl border border-[var(--surface-border)] bg-white py-2 text-[13px] font-semibold text-[var(--text-primary)] hover:bg-sys-gray-6 disabled:opacity-60 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => decide('rejected')}
              disabled={pending !== null}
              className="flex-1 rounded-xl bg-accent-red py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-60 transition"
            >
              {pending === 'reject' ? 'Rejecting…' : 'Confirm reject'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => decide('approved')}
            disabled={pending !== null}
            className="flex-1 rounded-xl bg-accent-green py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-60 transition"
          >
            {pending === 'approve' ? 'Approving…' : 'Approve'}
          </button>
          <button
            type="button"
            onClick={() => setShowReject(true)}
            disabled={pending !== null}
            className="flex-1 rounded-xl bg-accent-red py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-60 transition"
          >
            Reject
          </button>
        </div>
      )}
    </li>
  );
}
