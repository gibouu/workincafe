'use client';

import { useState, type ReactNode } from 'react';
import { Icon } from '@/components/icons/Icon';

const REASON_LABEL: Record<string, string> = {
  spam: 'Spam',
  offensive: 'Offensive',
  untrue: 'Untrue',
  irrelevant: 'Irrelevant',
  other: 'Other',
};

export interface FlaggedReviewRecord {
  id: string;
  reason: string;
  notes: string | null;
  created_at: string;
  reviews: {
    id: string;
    comment: string | null;
    overall_rating: number | null;
    geo_verified: boolean | null;
    user_id: string;
    places: { name: string | null } | null;
  } | null;
}

type Decision = 'dismiss' | 'hide' | 'ban';

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

const DONE_LABEL: Record<Decision, string> = {
  dismiss: 'dismissed',
  hide: 'review hidden',
  ban: 'review hidden · author banned',
};

const ACTION_LABEL: Record<Decision, string> = {
  dismiss: 'Dismiss',
  hide: 'Hide review',
  ban: 'Ban author',
};

export function FlaggedReviewRow({
  flag,
  leading,
}: {
  flag: FlaggedReviewRecord;
  /** Optional top-left slot — used by the bulk-select queue wrapper to
   *  inject a checkbox without owning the row layout (#167). */
  leading?: ReactNode;
}) {
  const [pending, setPending] = useState<Decision | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showReason, setShowReason] = useState<Decision | null>(null);
  const [reason, setReason] = useState('');

  if (done) {
    return (
      <li className="rounded-2xl border border-[var(--surface-border)] bg-white p-4 shadow-card">
        <div className="text-[13px] text-[var(--text-secondary)]">
          {flag.reviews?.places?.name ?? '(place not found)'} — {done}
        </div>
      </li>
    );
  }

  const submit = async (decision: Decision) => {
    setPending(decision);
    setError(null);
    try {
      const resp = await fetch(`/api/admin/flagged-reviews/${flag.id}/decision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          decision,
          reason: reason.trim() || undefined,
        }),
      });
      if (!resp.ok) {
        const body = (await resp.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `request failed (${resp.status})`);
      }
      setDone(DONE_LABEL[decision]);
      setShowReason(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setPending(null);
    }
  };

  const onClick = (decision: Decision) => {
    // Hide and ban are destructive — collect an optional reason. Dismiss
    // commits immediately.
    if (decision === 'dismiss') {
      void submit(decision);
      return;
    }
    if (showReason === decision) {
      void submit(decision);
      return;
    }
    setShowReason(decision);
  };

  return (
    <li className="rounded-2xl border border-[var(--surface-border)] bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        {leading}
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-[var(--text-primary)]">
            {flag.reviews?.places?.name ?? '(place not found)'}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
            <span className="rounded-full bg-accent-red-tint px-2 py-0.5 text-accent-red font-semibold">
              {REASON_LABEL[flag.reason] ?? flag.reason}
            </span>
            <span>flagged {timeAgo(flag.created_at)}</span>
          </div>
        </div>
        {flag.reviews && (
          <div className="shrink-0 text-right">
            <div className="mt-1 flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
              <Icon
                name={flag.reviews.geo_verified ? 'CheckCircle' : 'Warning'}
                size={12}
                weight="fill"
                className={
                  flag.reviews.geo_verified ? 'text-accent-green' : 'text-accent-amber'
                }
              />
              <span>{flag.reviews.geo_verified ? 'Geo-verified' : 'Unverified'}</span>
            </div>
          </div>
        )}
      </div>

      {flag.notes && (
        <div className="mt-2 rounded-xl bg-sys-gray-6 px-3 py-2 text-[12px] text-[var(--text-secondary)]">
          <span className="font-semibold">Reporter notes:</span> {flag.notes}
        </div>
      )}

      {flag.reviews?.comment && (
        <blockquote className="mt-3 border-l-2 border-sys-gray-4 pl-3 text-[13px] italic text-[var(--text-primary)]">
          {flag.reviews.comment}
        </blockquote>
      )}

      {showReason && showReason !== 'dismiss' && (
        <div className="mt-3">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Optional moderator note
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              showReason === 'ban'
                ? 'Why this user is banned (visible in admin logs only)'
                : 'Why this review is hidden (visible in admin logs only)'
            }
            className="mt-1 w-full rounded-xl border border-[var(--surface-border)] bg-white px-3 py-2 text-[13px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <div className="mt-2 text-[11px] text-[var(--text-secondary)]">
            Confirm by tapping &ldquo;{ACTION_LABEL[showReason]}&rdquo; again.
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-xl bg-accent-red-tint px-3 py-2 text-[12px] text-accent-red">
          {error}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onClick('dismiss')}
          disabled={pending !== null}
          className="rounded-2xl border border-[var(--surface-border)] bg-white px-4 py-2 text-[13px] font-medium text-[var(--text-primary)] hover:bg-sys-gray-6 disabled:opacity-60"
        >
          {pending === 'dismiss' ? 'Dismissing…' : 'Dismiss'}
        </button>
        <button
          type="button"
          onClick={() => onClick('hide')}
          disabled={pending !== null}
          className={`rounded-2xl px-4 py-2 text-[13px] font-medium transition disabled:opacity-60 ${
            showReason === 'hide'
              ? 'bg-accent-amber text-white'
              : 'border border-accent-amber text-accent-amber hover:bg-accent-amber-tint'
          }`}
        >
          {pending === 'hide' ? 'Hiding…' : showReason === 'hide' ? 'Confirm hide' : 'Hide review'}
        </button>
        <button
          type="button"
          onClick={() => onClick('ban')}
          disabled={pending !== null}
          className={`rounded-2xl px-4 py-2 text-[13px] font-medium transition disabled:opacity-60 ${
            showReason === 'ban'
              ? 'bg-accent-red text-white'
              : 'border border-accent-red text-accent-red hover:bg-accent-red-tint'
          }`}
        >
          {pending === 'ban' ? 'Banning…' : showReason === 'ban' ? 'Confirm ban' : 'Ban author'}
        </button>
      </div>
    </li>
  );
}
