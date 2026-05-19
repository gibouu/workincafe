'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/icons/Icon';

interface AccountSummary {
  account_id?: string;
  stripe_account_id?: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  country: string | null;
}

interface OnboardResponse {
  enabled: boolean;
  fresh?: boolean;
  account: AccountSummary | null;
}

export function PayoutsCard({ country }: { country?: string }) {
  const [state, setState] = useState<OnboardResponse | null>(null);
  const [stripeAvailable, setStripeAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    fetch('/api/stripe/onboard')
      .then(async (r) => {
        if (r.status === 503) {
          if (!aborted) setStripeAvailable(false);
          return null;
        }
        if (!r.ok) return null;
        return r.json();
      })
      .then((data: OnboardResponse | null) => {
        if (aborted) return;
        if (data) {
          setStripeAvailable(true);
          setState(data);
        }
      })
      .catch(() => {
        if (!aborted) setStripeAvailable(false);
      });
    return () => {
      aborted = true;
    };
  }, []);

  const startOnboarding = async () => {
    setBusy(true);
    setError(null);
    try {
      const resp = await fetch('/api/stripe/onboard', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ country }),
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(body.error ?? `request failed (${resp.status})`);
      window.location.assign(body.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start onboarding');
      setBusy(false);
    }
  };

  if (stripeAvailable === false) {
    return (
      <div className="rounded-2xl border border-(--surface-border) bg-white p-5 shadow-card">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-(--text-primary)">
          <Icon name="CreditCard" size={16} className="text-(--text-secondary)" />
          <span>Payouts</span>
          <span className="ml-auto rounded-full bg-sys-gray-6 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-(--text-tertiary)">
            Demo mode
          </span>
        </div>
        <p className="mt-2 text-[12px] text-(--text-secondary)">
          Stripe payouts aren&apos;t configured on this environment yet. Purchases run on a demo
          path — no real money moves. The operator wires Stripe keys when ready, then this card
          will let you connect a payout account.
        </p>
      </div>
    );
  }

  if (stripeAvailable === null) {
    return (
      <div className="rounded-2xl border border-(--surface-border) bg-white p-5 shadow-card text-[12px] text-(--text-tertiary)">
        Loading payouts…
      </div>
    );
  }

  const account = state?.account ?? null;
  const ready = Boolean(account?.payouts_enabled && account?.charges_enabled);
  const partial = Boolean(account && !ready && account.details_submitted);

  return (
    <div className="rounded-2xl border border-(--surface-border) bg-white p-5 shadow-card">
      <div className="flex items-center gap-2">
        <Icon name="CreditCard" size={16} className="text-(--text-secondary)" />
        <span className="text-[14px] font-semibold text-(--text-primary)">Payouts</span>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
            ready
              ? 'bg-accent-green-tint text-accent-green'
              : partial
                ? 'bg-accent-amber-tint text-accent-amber'
                : 'bg-sys-gray-6 text-(--text-tertiary)'
          }`}
        >
          {ready ? 'Stripe ready' : partial ? 'Stripe pending' : 'Not connected'}
        </span>
      </div>

      {ready && (
        <p className="mt-2 text-[12px] text-(--text-secondary)">
          You&apos;re set up. Customer purchases route through Stripe Connect — your bank gets paid
          out on Stripe&apos;s default schedule.
        </p>
      )}
      {partial && (
        <p className="mt-2 text-[12px] text-(--text-secondary)">
          Stripe needs a bit more info. Pick up where you left off.
        </p>
      )}
      {!account && (
        <p className="mt-2 text-[12px] text-(--text-secondary)">
          Connect a Stripe account so customer purchases land in your bank. Express onboarding
          takes about 2 minutes (legal name, address, ID, bank account).
        </p>
      )}

      {error && (
        <div className="mt-3 rounded-xl bg-accent-red-tint p-2 text-[12px] text-accent-red">
          {error}
        </div>
      )}

      {!ready && (
        <button
          type="button"
          onClick={startOnboarding}
          disabled={busy}
          className="mt-4 w-full rounded-2xl bg-accent py-2.5 text-[14px] font-semibold text-white hover:opacity-90 disabled:bg-sys-gray-4"
        >
          {busy ? 'Opening Stripe…' : account ? 'Continue Stripe setup' : 'Set up payouts'}
        </button>
      )}
    </div>
  );
}
