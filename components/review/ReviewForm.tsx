'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icons/Icon';
import { StarRow } from '@/components/review/StarRow';
import { categoryMeta } from '@/lib/categories';
import { haversineMeters } from '@/lib/geo';
import { runSpeedtest } from '@/lib/measurement/speedtest';
import { runDecibelTest } from '@/lib/measurement/decibel';
import type { DemoPlace } from '@/lib/demo/paris-places';

type GeoState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ok'; meters: number; lat: number; lng: number }
  | { kind: 'far'; meters: number }
  | { kind: 'denied'; message: string };

const MAX_DISTANCE_METERS = 150;
const FOOD_FORWARD = new Set(['restaurant', 'fast_food', 'bakery']);

interface Ratings {
  overall: number;
  wifi: number;
  noise: number;
  seating: number;
  outlets: number;
  price: number;
  atmosphere: number;
  temperature: number;
  food: number;
}

const EMPTY: Ratings = {
  overall: 0,
  wifi: 0,
  noise: 0,
  seating: 0,
  outlets: 0,
  price: 0,
  atmosphere: 0,
  temperature: 0,
  food: 0,
};

export function ReviewForm({ place }: { place: DemoPlace }) {
  const meta = categoryMeta(place.category);
  const needsFood = FOOD_FORWARD.has(place.category);

  const [geo, setGeo] = useState<GeoState>({ kind: 'idle' });
  const [ratings, setRatings] = useState<Ratings>(EMPTY);
  const [wifiMbps, setWifiMbps] = useState<number | null>(null);
  const [wifiLoading, setWifiLoading] = useState(false);
  const [decibel, setDecibel] = useState<number | null>(null);
  const [decibelLoading, setDecibelLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Geo check on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeo({ kind: 'denied', message: 'Geolocation is not supported by this browser.' });
      return;
    }
    setGeo({ kind: 'checking' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const meters = haversineMeters(
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          { lat: place.lat, lng: place.lng },
        );
        setGeo(
          meters <= MAX_DISTANCE_METERS
            ? { kind: 'ok', meters, lat: pos.coords.latitude, lng: pos.coords.longitude }
            : { kind: 'far', meters },
        );
      },
      (err) => setGeo({ kind: 'denied', message: err.message || 'Location access denied.' }),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [place.lat, place.lng]);

  const runWifiTest = async () => {
    setWifiLoading(true);
    try {
      const result = await runSpeedtest();
      setWifiMbps(result.download_mbps);
    } catch {
      setWifiMbps(null);
    }
    setWifiLoading(false);
  };

  const runDecibel = async () => {
    setDecibelLoading(true);
    try {
      const result = await runDecibelTest(10);
      setDecibel(Math.round(result.avg_db));
    } catch {
      setDecibel(null);
    }
    setDecibelLoading(false);
  };

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit =
    geo.kind === 'ok' &&
    ratings.overall > 0 &&
    comment.length <= 280 &&
    !submitting;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || geo.kind !== 'ok') return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const resp = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          place_id: place.id,
          overall_rating: ratings.overall,
          wifi_rating: ratings.wifi || null,
          noise_rating: ratings.noise || null,
          seating_rating: ratings.seating || null,
          outlets_rating: ratings.outlets || null,
          price_rating: ratings.price || null,
          atmosphere_rating: ratings.atmosphere || null,
          temperature_rating: ratings.temperature || null,
          food_rating: needsFood ? ratings.food || null : null,
          comment: comment.trim() || null,
          verified_lat: geo.lat,
          verified_lng: geo.lng,
        }),
      });
      const body = (await resp.json().catch(() => ({}))) as { error?: string };
      if (!resp.ok) {
        // If DB isn't live yet we still mark as submitted to preserve the demo UX.
        if (resp.status === 404 || resp.status === 401 || resp.status === 503) {
          setSubmitted(true);
          return;
        }
        throw new Error(body.error ?? `request failed (${resp.status})`);
      }
      // Fire-and-forget measurements if collected
      if (wifiMbps !== null) {
        void fetch('/api/wifi-tests', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            place_id: place.id,
            lat: place.lat,
            lng: place.lng,
            download_mbps: wifiMbps,
          }),
        });
      }
      if (decibel !== null) {
        void fetch('/api/decibel', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ place_id: place.id, avg_db: decibel }),
        });
      }
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--map-bg)] px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-green-tint">
          <Icon name="CheckCircle" weight="fill" size={44} className="text-accent-green" />
        </div>
        <h1 className="mt-5 text-[28px] font-bold text-[var(--text-primary)]">Thanks!</h1>
        <p className="mt-2 max-w-xs text-[14px] text-[var(--text-secondary)]">
          Your review would be saved once we wire the database. Demo complete.
        </p>
        <Link
          href="/"
          className="mt-8 rounded-2xl bg-accent px-6 py-3 text-[15px] font-semibold text-white hover:opacity-90 transition"
        >
          Back to map
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="min-h-dvh bg-[var(--map-bg)] pb-32">
      <header className="sticky top-0 z-10 border-b border-[var(--surface-border)] bg-white/90 backdrop-blur-ios">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link
            href={`/place/${place.id}`}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-sys-gray-6"
            aria-label="Back"
          >
            <Icon name="X" size={18} />
          </Link>
          <div className="text-[15px] font-semibold text-[var(--text-primary)]">Leave a review</div>
          <div className="w-9" />
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 pt-5">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full text-white shadow-bubble"
            style={{ background: meta.color }}
          >
            <Icon name={meta.icon} size={22} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[17px] font-semibold text-[var(--text-primary)]">
              {place.name}
            </div>
            <div className="truncate text-[12px] text-[var(--text-secondary)]">
              {place.address} · {place.neighborhood}
            </div>
          </div>
        </div>

        <GeoBanner geo={geo} />

        <section className="mt-6 rounded-2xl border border-[var(--surface-border)] bg-white p-4 shadow-card">
          <div className="text-[13px] font-semibold text-[var(--text-primary)]">Rate your visit</div>
          <div className="mt-2">
            <StarRow
              icon="Star"
              label="Overall"
              value={ratings.overall}
              onChange={(v) => setRatings((r) => ({ ...r, overall: v }))}
            />
            <StarRow
              icon="WifiHigh"
              label="Wi-Fi"
              value={ratings.wifi}
              onChange={(v) => setRatings((r) => ({ ...r, wifi: v }))}
            />
            <StarRow
              icon="SpeakerSimpleLow"
              label="Noise"
              value={ratings.noise}
              onChange={(v) => setRatings((r) => ({ ...r, noise: v }))}
            />
            <StarRow
              icon="Armchair"
              label="Seating comfort"
              value={ratings.seating}
              onChange={(v) => setRatings((r) => ({ ...r, seating: v }))}
            />
            <StarRow
              icon="Plug"
              label="Outlets"
              value={ratings.outlets}
              onChange={(v) => setRatings((r) => ({ ...r, outlets: v }))}
            />
            <StarRow
              icon="CurrencyEur"
              label="Price"
              value={ratings.price}
              onChange={(v) => setRatings((r) => ({ ...r, price: v }))}
            />
            <StarRow
              icon="Sun"
              label="Atmosphere"
              value={ratings.atmosphere}
              onChange={(v) => setRatings((r) => ({ ...r, atmosphere: v }))}
            />
            <StarRow
              icon="Thermometer"
              label="Temperature"
              value={ratings.temperature}
              onChange={(v) => setRatings((r) => ({ ...r, temperature: v }))}
            />
            {needsFood && (
              <StarRow
                icon="ForkKnife"
                label="Food"
                value={ratings.food}
                onChange={(v) => setRatings((r) => ({ ...r, food: v }))}
              />
            )}
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-[var(--surface-border)] bg-white p-4 shadow-card">
          <div className="text-[13px] font-semibold text-[var(--text-primary)]">Measurements</div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <TestTile
              icon="WifiHigh"
              label="Wi-Fi speed"
              value={wifiMbps !== null ? `${wifiMbps} Mbps` : 'Run test'}
              loading={wifiLoading}
              onClick={runWifiTest}
            />
            <TestTile
              icon="SpeakerSimpleLow"
              label="Noise"
              value={decibel !== null ? `${decibel} dB` : 'Sample 10 s'}
              loading={decibelLoading}
              onClick={runDecibel}
            />
          </div>
          <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
            Demo stubs. We process sound locally and never upload audio.
          </p>
        </section>

        <section className="mt-4 rounded-2xl border border-[var(--surface-border)] bg-white p-4 shadow-card">
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-semibold text-[var(--text-primary)]">Comment</div>
            <div className="text-[11px] text-[var(--text-tertiary)]">{comment.length}/280</div>
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 280))}
            placeholder="Anything a future worker should know?"
            rows={4}
            className="mt-2 w-full resize-none rounded-xl border border-[var(--surface-border)] bg-[var(--map-bg)] px-3 py-2 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-[var(--surface-border)] bg-white/95 p-4 backdrop-blur-ios">
        <div className="mx-auto max-w-2xl">
          {submitError && (
            <div className="mb-2 rounded-xl bg-accent-red-tint p-2 text-center text-[12px] text-accent-red">
              {submitError}
            </div>
          )}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-2xl bg-accent py-3.5 text-[15px] font-semibold text-white hover:opacity-90 disabled:bg-sys-gray-4 disabled:cursor-not-allowed transition"
          >
            {submitting
              ? 'Submitting…'
              : geo.kind === 'ok' && ratings.overall === 0
                ? 'Rate overall to continue'
                : 'Submit review'}
          </button>
        </div>
      </div>
    </form>
  );
}

function GeoBanner({ geo }: { geo: GeoState }) {
  if (geo.kind === 'idle' || geo.kind === 'checking') {
    return (
      <div className="mt-5 flex items-center gap-2 rounded-2xl bg-sys-gray-6 px-4 py-3 text-[13px] text-[var(--text-secondary)]">
        <Icon name="CircleNotch" size={16} className="animate-spin" />
        <span>Checking your location…</span>
      </div>
    );
  }
  if (geo.kind === 'ok') {
    return (
      <div className="mt-5 flex items-center gap-2 rounded-2xl bg-accent-green-tint px-4 py-3 text-[13px] text-accent-green">
        <Icon name="MapPinLine" size={16} weight="fill" />
        <span>You&apos;re here ({Math.round(geo.meters)} m away).</span>
      </div>
    );
  }
  if (geo.kind === 'far') {
    return (
      <div className="mt-5 flex items-center gap-2 rounded-2xl bg-accent-amber-tint px-4 py-3 text-[13px] text-accent-amber">
        <Icon name="Info" size={16} weight="fill" />
        <span>
          You&apos;re {(geo.meters / 1000).toFixed(1)} km from this place. Reviews require being
          within 150 m.
        </span>
      </div>
    );
  }
  return (
    <div className="mt-5 flex items-center gap-2 rounded-2xl bg-accent-red-tint px-4 py-3 text-[13px] text-accent-red">
      <Icon name="Warning" size={16} weight="fill" />
      <span>{geo.message}</span>
    </div>
  );
}

function TestTile({
  icon,
  label,
  value,
  loading,
  onClick,
}: {
  icon: 'WifiHigh' | 'SpeakerSimpleLow';
  label: string;
  value: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex flex-col items-start rounded-xl border border-[var(--surface-border)] bg-[var(--map-bg)] px-3 py-3 text-left transition hover:bg-sys-gray-6 disabled:opacity-60"
    >
      <Icon
        name={loading ? 'CircleNotch' : icon}
        size={20}
        className={loading ? 'animate-spin text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}
      />
      <div className="mt-1 text-[11px] text-[var(--text-secondary)]">{label}</div>
      <div className="text-[14px] font-semibold text-[var(--text-primary)]">{value}</div>
    </button>
  );
}
