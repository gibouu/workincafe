'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icons/Icon';

export interface AdminReviewRecord {
  id: string;
  place_id: string;
  user_id: string;
  overall_rating: number | null;
  comment: string | null;
  is_hidden: boolean;
  source: string | null;
  created_at: string;
  updated_at: string;
  upvotes_count: number;
  geo_verified: boolean;
  place_label: string | null;
  user_email: string | null;
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

export function AdminReviewRow({
  review: initial,
  onDeleted,
}: {
  review: AdminReviewRecord;
  onDeleted: (id: string) => void;
}) {
  const [review, setReview] = useState(initial);
  const [busy, setBusy] = useState<'hide' | 'restore' | 'delete' | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const toggleHidden = async () => {
    const next = !review.is_hidden;
    setBusy(next ? 'hide' : 'restore');
    setError(null);
    try {
      const resp = await fetch(`/api/admin/reviews/${review.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ is_hidden: next }),
      });
      if (!resp.ok) {
        const body = (await resp.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `request failed (${resp.status})`);
      }
      setReview((r) => ({ ...r, is_hidden: next }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'update failed');
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy('delete');
    setError(null);
    try {
      const resp = await fetch(`/api/admin/reviews/${review.id}`, { method: 'DELETE' });
      if (!resp.ok) {
        const body = (await resp.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `delete failed (${resp.status})`);
      }
      onDeleted(review.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'delete failed');
      setBusy(null);
    }
  };

  return (
    <li
      className={`rounded-2xl border p-4 shadow-card ${
        review.is_hidden
          ? 'border-accent-red-tint bg-accent-red-tint/40'
          : 'border-[var(--surface-border)] bg-white'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent">
          <span className="text-[14px] font-bold">
            {review.overall_rating != null ? review.overall_rating : '—'}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <Link
              href={`/place/${review.place_id}`}
              className="text-[14px] font-semibold text-[var(--text-primary)] hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {review.place_label ?? review.place_id.slice(0, 8)}
            </Link>
            {review.is_hidden && (
              <span className="rounded-full bg-accent-red px-2 py-0.5 text-[10px] font-semibold text-white">
                HIDDEN
              </span>
            )}
            {review.source && review.source !== 'user' && (
              <span className="rounded-full bg-sys-gray-5 px-2 py-0.5 text-[10px] font-semibold text-white">
                {review.source.toUpperCase()}
              </span>
            )}
          </div>
          <div className="text-[11px] text-[var(--text-tertiary)]">
            {review.user_email ?? review.user_id.slice(0, 8)} · {timeAgo(review.created_at)}
            {review.upvotes_count > 0 ? ` · ${review.upvotes_count} ▲` : ''}
            {review.geo_verified ? ' · geo ✓' : ''}
          </div>
          {review.comment && (
            <div className="mt-2 whitespace-pre-wrap text-[13px] text-[var(--text-primary)]">
              {review.comment}
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={toggleHidden}
            disabled={busy !== null}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-sys-gray-6 text-[var(--text-primary)] hover:bg-sys-gray-5 disabled:opacity-60 transition"
            aria-label={review.is_hidden ? 'Restore' : 'Hide'}
            title={review.is_hidden ? 'Restore' : 'Hide'}
          >
            <Icon name={review.is_hidden ? 'Eye' : 'EyeSlash'} size={14} />
          </button>
          <button
            type="button"
            onClick={() => {
              setShowConfirm(true);
              setConfirmText('');
            }}
            disabled={busy !== null}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-red-tint text-accent-red hover:opacity-90 disabled:opacity-60 transition"
            aria-label="Delete"
            title="Hard delete"
          >
            <Icon name="Trash" size={14} />
          </button>
        </div>
      </div>
      {showConfirm && (
        <div className="mt-3 rounded-xl border border-accent-red bg-accent-red-tint p-3">
          <div className="text-[12px] text-[var(--text-primary)]">
            Type <strong>DELETE</strong> to permanently remove this review. Prefer Hide for moderation.
          </div>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-white px-2 py-1.5 text-[13px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-accent-red"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowConfirm(false);
                setConfirmText('');
              }}
              disabled={busy !== null}
              className="flex-1 rounded-lg border border-[var(--surface-border)] bg-white py-1.5 text-[12px] font-semibold text-[var(--text-primary)] hover:bg-sys-gray-6 disabled:opacity-60 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={busy !== null || confirmText !== 'DELETE'}
              className="flex-1 rounded-lg bg-accent-red py-1.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-40 transition"
            >
              {busy === 'delete' ? 'Deleting…' : 'Confirm delete'}
            </button>
          </div>
        </div>
      )}
      {error && (
        <div className="mt-2 rounded-lg bg-accent-red-tint px-2 py-1 text-[12px] text-accent-red">
          {error}
        </div>
      )}
    </li>
  );
}
