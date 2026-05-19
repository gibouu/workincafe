'use client';

import { useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { categoryMeta } from '@/lib/categories';
import type { PlaceCategory } from '@/lib/categories';

interface ClaimRecord {
  id: string;
  place_id: string;
  claimant_email: string;
  claimant_name: string | null;
  proof_type: string;
  proof_path: string | null;
  proof_notes: string | null;
  status: string;
  created_at: string;
  places: {
    name: string;
    address: string | null;
    neighborhood: string | null;
    category: string;
  } | null;
}

const PROOF_LABEL: Record<string, string> = {
  storefront_photo: 'Storefront photo',
  business_doc: 'Business document',
  website_email: 'Domain email',
  other: 'Other',
};

export function ClaimRow({ claim }: { claim: ClaimRecord }) {
  const [pending, setPending] = useState<'approve' | 'reject' | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const meta = categoryMeta((claim.places?.category as PlaceCategory) ?? 'other');

  if (done) {
    return (
      <li className="rounded-2xl border border-(--surface-border) bg-white p-4 shadow-card">
        <div className="text-[13px] text-(--text-secondary)">
          {claim.places?.name ?? 'Place'} — {done}
        </div>
      </li>
    );
  }

  const decide = async (decision: 'approved' | 'rejected') => {
    setPending(decision === 'approved' ? 'approve' : 'reject');
    setError(null);
    try {
      const resp = await fetch(`/api/place-claims/${claim.id}/decision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error ?? `request failed (${resp.status})`);
      }
      setDone(decision === 'approved' ? 'approved' : 'rejected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setPending(null);
    }
  };

  return (
    <li className="rounded-2xl border border-(--surface-border) bg-white p-4 shadow-card">
      <div className="flex items-start gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-bubble"
          style={{ background: meta.color }}
        >
          <Icon name={meta.icon} size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-(--text-primary)">
            {claim.places?.name ?? '(place not found)'}
          </div>
          <div className="text-[12px] text-(--text-secondary)">
            {claim.places?.address} · {claim.places?.neighborhood}
          </div>
          <div className="mt-1 text-[11px] text-(--text-tertiary)">
            By {claim.claimant_name ?? '(no name)'} · {claim.claimant_email}
          </div>
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-sys-gray-6 px-2 py-0.5 text-[11px] font-medium text-(--text-secondary)">
            {PROOF_LABEL[claim.proof_type] ?? claim.proof_type}
            {claim.proof_path && ' · photo attached'}
          </div>
          {claim.proof_notes && (
            <div className="mt-2 whitespace-pre-wrap text-[13px] text-(--text-primary)">
              {claim.proof_notes}
            </div>
          )}
        </div>
      </div>
      {error && (
        <div className="mt-3 rounded-xl bg-accent-red-tint p-2 text-center text-[12px] text-accent-red">
          {error}
        </div>
      )}
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
          onClick={() => decide('rejected')}
          disabled={pending !== null}
          className="flex-1 rounded-xl bg-accent-red py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-60 transition"
        >
          {pending === 'reject' ? 'Rejecting…' : 'Reject'}
        </button>
      </div>
    </li>
  );
}
