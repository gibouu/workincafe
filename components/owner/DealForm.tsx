'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icons/Icon';
import { Section } from '@/components/ui/Section';
import { computeFee, formatCents } from '@/lib/loyalty/fees';

export interface DealFormInitial {
  id?: string;
  title: string;
  description: string;
  kind: 'single_use' | 'pack';
  pack_size: number;
  price_cents: number;
  currency: string;
  ends_at: string | null;
  purchase_limit_per_user: number | null;
  active: boolean;
}

export const EMPTY_DEAL: DealFormInitial = {
  title: '',
  description: '',
  kind: 'single_use',
  pack_size: 10,
  price_cents: 400,
  currency: 'EUR',
  ends_at: null,
  purchase_limit_per_user: null,
  active: false,
};

export function DealForm({
  placeId,
  initial,
  redirectTo,
}: {
  placeId: string;
  initial: DealFormInitial;
  redirectTo: string;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial.id);

  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [kind, setKind] = useState<'single_use' | 'pack'>(initial.kind);
  const [packSize, setPackSize] = useState(initial.pack_size);
  const [priceCents, setPriceCents] = useState(initial.price_cents);
  const [currency, setCurrency] = useState(initial.currency);
  const [endsAt, setEndsAt] = useState(initial.ends_at?.slice(0, 10) ?? '');
  const [limit, setLimit] = useState<number | ''>(initial.purchase_limit_per_user ?? '');
  const [active, setActive] = useState(initial.active);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fee = computeFee(priceCents);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        place_id: placeId,
        title,
        description,
        kind,
        pack_size: kind === 'pack' ? packSize : 1,
        price_cents: priceCents,
        currency,
        ends_at: endsAt ? new Date(`${endsAt}T23:59:59Z`).toISOString() : null,
        purchase_limit_per_user: typeof limit === 'number' && limit > 0 ? limit : null,
        active,
      };
      const url = isEdit ? `/api/deals/${initial.id}` : '/api/deals';
      const method = isEdit ? 'PATCH' : 'POST';
      const resp = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok && resp.status !== 503) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error ?? `request failed (${resp.status})`);
      }
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="pb-24">
      <Section title="Title">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 80))}
          placeholder="Coffee + croissant"
          required
          className="w-full rounded-xl border border-[var(--surface-border)] bg-white px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <div className="mt-1 text-right text-[10px] text-[var(--text-tertiary)]">
          {title.length}/80
        </div>
      </Section>

      <Section title="Description (optional)">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 280))}
          placeholder="What does this deal include? Any conditions?"
          rows={3}
          className="w-full resize-none rounded-xl border border-[var(--surface-border)] bg-white px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <div className="mt-1 text-right text-[10px] text-[var(--text-tertiary)]">
          {description.length}/280
        </div>
      </Section>

      <Section title="Kind">
        <div className="grid grid-cols-2 gap-2">
          <KindButton
            label="Single use"
            active={kind === 'single_use'}
            onClick={() => setKind('single_use')}
          />
          <KindButton
            label="Pack"
            active={kind === 'pack'}
            onClick={() => setKind('pack')}
          />
        </div>
        {kind === 'pack' && (
          <div className="mt-3">
            <label className="block text-[12px] font-medium text-[var(--text-secondary)]">
              Pack size (uses per purchase, max 100)
            </label>
            <input
              type="number"
              min={2}
              max={100}
              value={packSize}
              onChange={(e) => setPackSize(Math.max(2, Math.min(100, Number(e.target.value) || 0)))}
              className="mt-1 w-full rounded-xl border border-[var(--surface-border)] bg-white px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        )}
      </Section>

      <Section title="Price">
        <div className="flex items-center gap-2">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="rounded-xl border border-[var(--surface-border)] bg-white px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="EUR">EUR €</option>
            <option value="CAD">CAD C$</option>
          </select>
          <input
            type="number"
            min={0}
            step={0.01}
            value={(priceCents / 100).toFixed(2)}
            onChange={(e) => setPriceCents(Math.round((Number(e.target.value) || 0) * 100))}
            className="flex-1 rounded-xl border border-[var(--surface-border)] bg-white px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div className="mt-3 rounded-xl bg-sys-gray-6 px-3 py-2 text-[12px] text-[var(--text-secondary)]">
          <div className="flex items-center justify-between">
            <span>Customer pays</span>
            <span className="font-semibold text-[var(--text-primary)]">
              {formatCents(fee.total_cents, currency)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span>Platform fee (5% + €0.25)</span>
            <span>−{formatCents(fee.platform_fee_cents, currency)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between border-t border-[var(--surface-border)] pt-1">
            <span>You receive (before processor fees)</span>
            <span className="font-semibold text-accent-green">
              {formatCents(fee.owner_receives_cents, currency)}
            </span>
          </div>
        </div>
      </Section>

      <Section title="Expiry & limits">
        <label className="block">
          <div className="text-[12px] font-medium text-[var(--text-secondary)]">
            Ends at (optional)
          </div>
          <input
            type="date"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--surface-border)] bg-white px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
        <label className="mt-3 block">
          <div className="text-[12px] font-medium text-[var(--text-secondary)]">
            Purchase limit per user (blank = unlimited)
          </div>
          <input
            type="number"
            min={1}
            value={limit}
            onChange={(e) => {
              const v = e.target.value;
              setLimit(v === '' ? '' : Math.max(1, Number(v) || 0));
            }}
            placeholder="Unlimited"
            className="mt-1 w-full rounded-xl border border-[var(--surface-border)] bg-white px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
      </Section>

      <Section title="Status">
        <label className="flex items-center gap-3 rounded-xl border border-[var(--surface-border)] bg-white px-3 py-3">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          <span className="text-[14px] text-[var(--text-primary)]">
            Active — visible to customers and purchasable
          </span>
        </label>
      </Section>

      {error && (
        <div className="mt-4 rounded-xl bg-accent-red-tint p-3 text-center text-[13px] text-accent-red">
          {error}
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-[var(--surface-border)] bg-white/95 p-4 backdrop-blur-ios">
        <div className="mx-auto max-w-3xl">
          <button
            type="submit"
            disabled={submitting || !title.trim() || priceCents < 0}
            className="w-full rounded-2xl bg-accent py-3.5 text-[15px] font-semibold text-white hover:opacity-90 disabled:bg-sys-gray-4 disabled:cursor-not-allowed transition"
          >
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create deal'}
          </button>
        </div>
      </div>
    </form>
  );
}

function KindButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-3 text-[14px] font-semibold transition ${
        active
          ? 'border-transparent bg-accent text-white'
          : 'border-[var(--surface-border)] bg-white text-[var(--text-primary)] hover:bg-sys-gray-6'
      }`}
    >
      <Icon
        name={active ? 'CheckCircle' : 'Circle'}
        size={14}
        weight={active ? 'fill' : 'regular'}
        className="mr-1 inline-block align-middle"
      />
      {label}
    </button>
  );
}
