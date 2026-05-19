'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { FREEBIE_DISTINCT_PLACES, FREEBIE_POINT_COST } from '@/lib/loyalty/points';

interface Progress {
  balance: number;
  distinct_places: number;
  freebie_unlocked: boolean;
}

export function LoyaltyCard() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [howOpen, setHowOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    fetch('/api/loyalty/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!aborted && data) setProgress(data);
      })
      .catch(() => null);
    return () => {
      aborted = true;
    };
  }, []);

  const claim = async () => {
    setClaiming(true);
    setError(null);
    setClaimResult(null);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => {
        if (!navigator.geolocation) {
          rej(new Error('Geolocation not supported'));
          return;
        }
        navigator.geolocation.getCurrentPosition(res, rej, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });
      const resp = await fetch('/api/loyalty/claim-freebie', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          near: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        }),
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(body.error ?? `request failed (${resp.status})`);
      setClaimResult(`${body.place.name} — code ${body.qr_code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Claim failed');
    } finally {
      setClaiming(false);
    }
  };

  if (!progress) {
    return (
      <div className="rounded-2xl border border-(--surface-border) bg-white p-5 shadow-card">
        <div className="text-[11px] uppercase tracking-wide text-(--text-secondary)">
          Loyalty
        </div>
        <div className="mt-2 text-[13px] text-(--text-tertiary)">Loading…</div>
      </div>
    );
  }

  const ptsPct = Math.min(100, (progress.balance / FREEBIE_POINT_COST) * 100);
  const placesPct = Math.min(100, (progress.distinct_places / FREEBIE_DISTINCT_PLACES) * 100);

  return (
    <div className="rounded-2xl border border-(--surface-border) bg-white p-5 shadow-card">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-(--text-secondary)">
            Loyalty points
          </div>
          <div className="mt-1 text-[34px] font-bold text-(--text-primary)">
            {progress.balance}
          </div>
        </div>
        {progress.freebie_unlocked && (
          <div className="flex items-center gap-2 rounded-full bg-accent-green-tint px-3 py-1.5 text-[12px] font-semibold text-accent-green">
            <Icon name="Gift" size={14} weight="fill" />
            <span>Freebie unlocked</span>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-3">
        <ProgressBar
          label={`Points: ${progress.balance} / ${FREEBIE_POINT_COST}`}
          pct={ptsPct}
        />
        <ProgressBar
          label={`Distinct places: ${progress.distinct_places} / ${FREEBIE_DISTINCT_PLACES}`}
          pct={placesPct}
        />
      </div>

      {progress.freebie_unlocked && (
        <button
          type="button"
          onClick={claim}
          disabled={claiming}
          className="mt-4 w-full rounded-2xl bg-accent py-3 text-[14px] font-semibold text-white hover:opacity-90 disabled:bg-sys-gray-4"
        >
          {claiming ? 'Picking your café…' : 'Claim my free coffee'}
        </button>
      )}
      {claimResult && (
        <div className="mt-3 rounded-xl bg-accent-green-tint p-3 text-[12px] text-accent-green">
          We picked: {claimResult}. Show this code at the café.
        </div>
      )}
      {error && (
        <div className="mt-3 rounded-xl bg-accent-red-tint p-3 text-[12px] text-accent-red">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={() => setHowOpen((o) => !o)}
        className="mt-4 inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:opacity-80"
      >
        <Icon name={howOpen ? 'CaretUp' : 'CaretDown'} size={12} />
        How it works
      </button>
      {howOpen && (
        <div className="mt-2 space-y-1.5 text-[12px] text-(--text-secondary)">
          <p>• Buy a deal in the app, walk in, café scans your code → +1 point per scan.</p>
          <p>
            • Earn {FREEBIE_POINT_COST} points across {FREEBIE_DISTINCT_PLACES} different places to
            unlock a free coffee.
          </p>
          <p>
            • The free coffee goes to a random nearby café you&apos;ve never visited — keeps the
            system honest.
          </p>
          <p>• Points expire 12 months after you earn them.</p>
        </div>
      )}
    </div>
  );
}

function ProgressBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <div className="text-[11px] text-(--text-secondary)">{label}</div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-sys-gray-5">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
