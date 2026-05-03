'use client';

import { useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { computeFee, formatCents } from '@/lib/loyalty/fees';
import type { Ticket } from '@/components/card/DealTicketModal';

interface PurchaseDeal {
  id: string;        // real deals only — must be a real uuid
  title: string;
  description?: string;
  kind: 'single_use' | 'pack';
  pack_size: number;
  price_cents: number;
  currency: string;
}

export function DealPurchaseModal({
  deal,
  onClose,
  onPurchased,
}: {
  deal: PurchaseDeal;
  onClose: () => void;
  onPurchased: (ticket: Ticket) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fee = computeFee(deal.price_cents);

  const buy = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const resp = await fetch(`/api/deals/${deal.id}/purchase`, { method: 'POST' });
      if (resp.status === 401) {
        window.location.assign('/auth?next=' + encodeURIComponent(window.location.pathname));
        return;
      }
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(body.error ?? `request failed (${resp.status})`);
      onPurchased({
        id: body.id,
        qr_code: body.qr_code,
        uses_total: body.uses_total,
        uses_remaining: body.uses_remaining,
        title: deal.title,
        amount_paid_cents: body.amount_paid_cents,
        currency: body.currency,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-float">
        <div className="flex items-center justify-between">
          <div className="text-[17px] font-semibold text-[var(--text-primary)]">{deal.title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-sys-gray-6"
          >
            <Icon name="X" size={14} />
          </button>
        </div>
        {deal.description && (
          <p className="mt-2 text-[13px] text-[var(--text-secondary)]">{deal.description}</p>
        )}

        <div className="mt-4 rounded-xl bg-sys-gray-6 px-3 py-3 text-[13px]">
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-secondary)]">
              {deal.kind === 'pack' ? `Pack of ${deal.pack_size}` : 'Single use'}
            </span>
            <span className="text-[15px] font-semibold text-[var(--text-primary)]">
              {formatCents(fee.total_cents, deal.currency)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--text-tertiary)]">
            <span>Includes platform fee</span>
            <span>{formatCents(fee.platform_fee_cents, deal.currency)}</span>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-xl bg-accent-red-tint p-2 text-center text-[12px] text-accent-red">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={buy}
          disabled={submitting}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 text-[15px] font-semibold text-white hover:opacity-90 disabled:bg-sys-gray-4"
        >
          <Icon name="CreditCard" size={16} />
          <span>
            {submitting
              ? 'Processing…'
              : `Demo: pay ${formatCents(fee.total_cents, deal.currency)} (no real charge)`}
          </span>
        </button>
        <p className="mt-2 text-center text-[10px] text-[var(--text-tertiary)]">
          Real card payments via Stripe Connect land in a future update.
        </p>
      </div>
    </div>
  );
}
