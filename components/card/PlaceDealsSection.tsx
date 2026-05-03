'use client';

import { useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { formatCents } from '@/lib/loyalty/fees';
import { demoDealsForPlace, type DemoDeal } from '@/lib/demo/deals';
import { DealPurchaseModal } from '@/components/card/DealPurchaseModal';
import { DealTicketModal, type Ticket } from '@/components/card/DealTicketModal';

export function PlaceDealsSection({ placeId }: { placeId: string }) {
  const demos = demoDealsForPlace(placeId);

  const [activeDemo, setActiveDemo] = useState<DemoDeal | null>(null);
  const [activeReal, setActiveReal] = useState<DemoDeal | null>(null);
  const [issuedTicket, setIssuedTicket] = useState<Ticket | null>(null);
  const [showDemoExplainer, setShowDemoExplainer] = useState(false);

  if (demos.length === 0) return null;

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[13px] font-semibold text-[var(--text-primary)]">Deals</div>
        <span className="rounded-full bg-sys-gray-6 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
          Preview
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {demos.map((deal) => (
          <li
            key={deal.id}
            className="rounded-2xl border border-[var(--surface-border)] bg-white p-4 shadow-card"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent">
                <Icon name="Gift" size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-[var(--text-primary)]">
                    {deal.title}
                  </span>
                  {deal.kind === 'pack' && (
                    <span className="rounded-full bg-sys-gray-6 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                      Pack of {deal.pack_size}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[12px] text-[var(--text-secondary)]">{deal.description}</p>
                <div className="mt-2 text-[15px] font-semibold text-accent">
                  {formatCents(deal.price_cents, deal.currency)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDemoExplainer(true)}
                className="shrink-0 rounded-xl bg-accent px-3 py-2 text-[12px] font-semibold text-white hover:opacity-90"
              >
                Buy in app
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
        Demo deals shown for preview. Real deals appear here once a partner café claims this place
        and publishes them.
      </p>

      {showDemoExplainer && (
        <PreviewExplainer onClose={() => setShowDemoExplainer(false)} />
      )}
      {activeDemo && (
        <DealPurchaseModal
          deal={activeDemo}
          onClose={() => setActiveDemo(null)}
          onPurchased={(t) => {
            setActiveDemo(null);
            setIssuedTicket(t);
          }}
        />
      )}
      {activeReal && null /* placeholder for real deals once we render them */}
      {issuedTicket && (
        <DealTicketModal ticket={issuedTicket} onClose={() => setIssuedTicket(null)} />
      )}
    </div>
  );
}

function PreviewExplainer({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-float">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-tint text-accent">
            <Icon name="Sparkle" size={18} />
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-semibold text-[var(--text-primary)]">Preview only</div>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              We&apos;re not signed up with this café yet, so this deal is just a preview of how
              they&apos;ll work. Pay in the app, get a QR, walk in, the café scans it. Buy a single
              coffee or a pack — your choice.
            </p>
            <p className="mt-2 text-[12px] text-[var(--text-tertiary)]">
              Own a place? Tap “Own this place? Claim it” at the bottom of the card.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-2xl bg-accent py-2.5 text-[14px] font-semibold text-white hover:opacity-90"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
