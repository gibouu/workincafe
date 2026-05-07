'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/icons/Icon';

// Persistent (not auto-dismissed) recovery instructions when the user
// taps the geolocate button while permission has been previously
// denied. Replaces the missable toast that today's `handleGeolocate`
// fires on PERMISSION_DENIED. See #71.
//
// Manual address fallback was added when a user reported Safari
// permission state stuck "deny" beyond what the AA → Website Settings
// flow could clear. This lets them set their location by typing an
// address — no `getCurrentPosition` involved.

function detectPlatform(): 'ios-safari' | 'android-chrome' | 'desktop' | 'unknown' {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/iP(hone|ad|od)/.test(ua)) return 'ios-safari';
  if (/Android/i.test(ua)) return 'android-chrome';
  if (/Windows|Macintosh|Linux/i.test(ua)) return 'desktop';
  return 'unknown';
}

interface Step {
  text: string;
  emphasis?: string;
}

function stepsFor(platform: ReturnType<typeof detectPlatform>): Step[] {
  switch (platform) {
    case 'ios-safari':
      return [
        { text: 'Tap', emphasis: 'AA' },
        { text: 'in the URL bar' },
        { text: 'Open', emphasis: 'Website Settings' },
        { text: 'Set', emphasis: 'Location → Allow' },
        { text: 'Refresh this page' },
      ];
    case 'android-chrome':
      return [
        { text: 'Tap the lock icon left of the URL' },
        { text: 'Open', emphasis: 'Permissions' },
        { text: 'Toggle', emphasis: 'Location → Allow' },
        { text: 'Refresh this page' },
      ];
    case 'desktop':
      return [
        { text: 'Click the lock icon in the address bar' },
        { text: 'Open', emphasis: 'Site settings' },
        { text: 'Set', emphasis: 'Location → Allow' },
        { text: 'Refresh this page' },
      ];
    default:
      return [
        { text: 'Open browser settings for this site' },
        { text: 'Set', emphasis: 'Location → Allow' },
        { text: 'Refresh this page' },
      ];
  }
}

interface AddressPrediction {
  placeId: string;
  text: string;
  primary: string;
  secondary: string;
}

interface AddressDetails {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  types: string[];
}

export interface ManualLocationPick {
  lat: number;
  lng: number;
  label: string;
}

export function GeolocateBlockedBanner({
  open,
  onClose,
  onManualLocation,
}: {
  open: boolean;
  onClose: () => void;
  /** Fired when the user picks an address from the manual fallback.
   *  Caller is expected to cache + pan + close the banner. */
  onManualLocation?: (pick: ManualLocationPick) => void;
}) {
  const [platform, setPlatform] = useState<ReturnType<typeof detectPlatform>>('unknown');
  const [showManual, setShowManual] = useState(false);
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<AddressPrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  // Reset all manual-mode state when the banner closes so reopening
  // starts on the recovery steps again.
  useEffect(() => {
    if (!open) {
      setShowManual(false);
      setQuery('');
      setPredictions([]);
    }
  }, [open]);

  // Debounced address autocomplete. Same endpoint the add-place wizard
  // uses (`kind=address` runs Photon without POI filters), so even
  // without paid keys it resolves any street address.
  useEffect(() => {
    if (!showManual) return;
    const q = query.trim();
    if (q.length < 3) {
      setPredictions([]);
      return;
    }
    let aborted = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q, kind: 'address' });
        const resp = await fetch(`/api/places/lookup?${params.toString()}`);
        if (!resp.ok) {
          if (!aborted) setPredictions([]);
          return;
        }
        const body = (await resp.json()) as { predictions?: AddressPrediction[] };
        if (!aborted) setPredictions(body.predictions ?? []);
      } catch {
        if (!aborted) setPredictions([]);
      } finally {
        if (!aborted) setSearching(false);
      }
    }, 300);
    return () => {
      aborted = true;
      clearTimeout(t);
    };
  }, [showManual, query]);

  const onPick = async (p: AddressPrediction) => {
    if (picking) return;
    setPicking(true);
    try {
      const resp = await fetch(
        `/api/places/lookup?placeId=${encodeURIComponent(p.placeId)}`,
      );
      if (!resp.ok) return;
      const details = (await resp.json()) as AddressDetails;
      const label = [p.primary, p.secondary].filter(Boolean).join(', ');
      onManualLocation?.({ lat: details.lat, lng: details.lng, label });
    } catch {
      /* swallow — banner stays open so user can retry */
    } finally {
      setPicking(false);
    }
  };

  if (!open) return null;
  const steps = stepsFor(platform);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/30 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl border border-[var(--surface-border)] bg-white p-6 shadow-float sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="geolocate-blocked-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-red-tint text-accent-red">
            <Icon name="WarningCircle" size={22} weight="fill" />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sys-gray-6 text-[var(--text-secondary)] hover:bg-sys-gray-5 transition"
          >
            <Icon name="X" size={14} />
          </button>
        </div>

        <h2
          id="geolocate-blocked-title"
          className="mt-4 text-[20px] font-bold leading-tight text-[var(--text-primary)]"
        >
          {showManual ? 'Pick your location' : 'Location is blocked for this site'}
        </h2>
        <p className="mt-1 text-[14px] leading-snug text-[var(--text-secondary)]">
          {showManual
            ? "Type an address near where you are. We'll center the map there."
            : 'Your browser is rejecting the location request before it can reach us.'}
        </p>

        {!showManual ? (
          <>
            <ol className="mt-4 flex flex-col gap-2">
              {steps.map((s, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--map-bg)] px-3 py-2.5 text-[14px] text-[var(--text-primary)]"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white">
                    {i + 1}
                  </span>
                  <span className="flex-1">
                    {s.text}
                    {s.emphasis ? (
                      <>
                        {' '}
                        <span className="rounded-md bg-sys-gray-6 px-1.5 py-0.5 font-mono text-[12px] font-semibold">
                          {s.emphasis}
                        </span>
                      </>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--surface-border)]" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
                Or
              </span>
              <div className="h-px flex-1 bg-[var(--surface-border)]" />
            </div>

            <button
              type="button"
              onClick={() => setShowManual(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-3 py-3 text-[14px] font-semibold text-white transition hover:opacity-90"
            >
              <Icon name="MapPin" size={16} weight="fill" />
              <span>Set my location by address</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-[var(--surface-border)] bg-white px-3 py-3 text-[14px] font-semibold text-[var(--text-primary)] hover:bg-sys-gray-6"
            >
              Got it
            </button>
          </>
        ) : (
          <>
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--surface-border)] bg-white px-3 py-2.5 focus-within:ring-2 focus-within:ring-accent">
              <Icon name="MagnifyingGlass" size={16} className="text-[var(--text-tertiary)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="123 rue de Rivoli, Paris"
                autoFocus
                className="flex-1 bg-transparent text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
              />
              {searching && (
                <Icon
                  name="CircleNotch"
                  size={14}
                  className="animate-spin text-[var(--text-tertiary)]"
                />
              )}
            </div>

            {predictions.length > 0 && (
              <ul className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-[var(--surface-border)] bg-white shadow-card">
                {predictions.map((p) => (
                  <li key={p.placeId}>
                    <button
                      type="button"
                      onClick={() => onPick(p)}
                      disabled={picking}
                      className="block w-full px-3 py-2.5 text-left hover:bg-sys-gray-6 disabled:opacity-60"
                    >
                      <div className="text-[15px] font-medium text-[var(--text-primary)]">
                        {p.primary || p.text}
                      </div>
                      {p.secondary && (
                        <div className="text-[12px] text-[var(--text-secondary)]">
                          {p.secondary}
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-3 text-[12px] text-[var(--text-tertiary)]">
              The map will remember this for the next 24 hours. Re-enable
              precise location any time and the geolocate button will work.
            </p>

            <button
              type="button"
              onClick={() => setShowManual(false)}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-[var(--surface-border)] bg-white px-3 py-3 text-[14px] font-semibold text-[var(--text-primary)] hover:bg-sys-gray-6"
            >
              Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
