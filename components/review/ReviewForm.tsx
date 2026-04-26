'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon, type PhosphorIconName } from '@/components/icons/Icon';
import { StarRow } from '@/components/review/StarRow';
import { ScaleRow } from '@/components/review/ScaleRow';
import { categoryMeta } from '@/lib/categories';
import { haversineMeters } from '@/lib/geo';
import { runSpeedtest } from '@/lib/measurement/speedtest';
import { runDecibelTest } from '@/lib/measurement/decibel';
import type { DemoPlace } from '@/lib/demo/paris-places';
import { savePending, consumePending, buildAuthRedirect } from '@/lib/auth/pending-submit';

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
  food: number;
}

const EMPTY: Ratings = {
  overall: 0,
  wifi: 0,
  noise: 0,
  seating: 0,
  outlets: 0,
  food: 0,
};

type PriceRange = 'lt3' | '3_5' | '5_8' | 'gte8' | 'na';
type FoodPriceRange = PriceRange | 'did_not_eat';
type EnvFact = 'heating' | 'air_conditioning' | 'usually_cold' | 'usually_warm' | 'comfortable_today';
type WorkFact =
  | 'stay_long'
  | 'staff_chill'
  | 'forced_consumption'
  | 'hours_ok'
  | 'good_for_focus'
  | 'good_for_calls';
type PlaceType =
  | 'cafe'
  | 'bakery'
  | 'library'
  | 'coworking'
  | 'hotel_lobby'
  | 'restaurant'
  | 'fast_food'
  | 'gym_workspace'
  | 'other';
type CurrentSeating = 'plenty' | 'some' | 'full' | 'wait';

const DRINK_PRICE_OPTIONS: { value: PriceRange; label: string }[] = [
  { value: 'lt3', label: '<€3' },
  { value: '3_5', label: '€3–5' },
  { value: '5_8', label: '€5–8' },
  { value: 'gte8', label: '€8+' },
  { value: 'na', label: 'n/a' },
];

const FOOD_PRICE_OPTIONS: { value: FoodPriceRange; label: string }[] = [
  { value: 'did_not_eat', label: 'Did not eat' },
  { value: 'lt3', label: '<€5' },
  { value: '3_5', label: '€5–10' },
  { value: '5_8', label: '€10–20' },
  { value: 'gte8', label: '€20+' },
];

const ENV_OPTIONS: { value: EnvFact; label: string; icon: PhosphorIconName }[] = [
  { value: 'heating', label: 'Heating', icon: 'Fire' },
  { value: 'air_conditioning', label: 'Air conditioning', icon: 'Snowflake' },
  { value: 'usually_cold', label: 'Usually cold', icon: 'Thermometer' },
  { value: 'usually_warm', label: 'Usually warm', icon: 'Thermometer' },
  { value: 'comfortable_today', label: 'Comfortable today', icon: 'Smiley' },
];

const WORK_OPTIONS: { value: WorkFact; label: string }[] = [
  { value: 'stay_long', label: 'Could stay as long as I wanted' },
  { value: 'staff_chill', label: 'Staff chill about laptops' },
  { value: 'hours_ok', label: 'Felt ok to stay several hours' },
  { value: 'forced_consumption', label: 'Pressured to keep ordering' },
  { value: 'good_for_focus', label: 'Good for focused work' },
  { value: 'good_for_calls', label: 'Good for calls' },
];

const PLACE_TYPE_OPTIONS: { value: PlaceType; label: string }[] = [
  { value: 'cafe', label: 'Cafe' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'library', label: 'Library' },
  { value: 'coworking', label: 'Coworking' },
  { value: 'hotel_lobby', label: 'Hotel lobby' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'fast_food', label: 'Fast food' },
  { value: 'gym_workspace', label: 'Gym / club workspace' },
  { value: 'other', label: 'Other' },
];

const CURRENT_SEATING_OPTIONS: { value: CurrentSeating; label: string }[] = [
  { value: 'plenty', label: 'Plenty' },
  { value: 'some', label: 'Some' },
  { value: 'full', label: 'Full' },
  { value: 'wait', label: 'Wait/line' },
];

function priceValue(range: PriceRange | FoodPriceRange | null): number | null {
  if (!range || range === 'na' || range === 'did_not_eat') return null;
  // Map price buckets onto a "value" axis (cheaper = higher value).
  if (range === 'lt3') return 5;
  if (range === '3_5') return 4;
  if (range === '5_8') return 3;
  if (range === 'gte8') return 2;
  return null;
}

function ratingFromMbps(mbps: number): number {
  if (mbps < 5) return 1;
  if (mbps < 15) return 2;
  if (mbps < 30) return 3;
  if (mbps < 60) return 4;
  return 5;
}

function ratingFromDb(db: number): number {
  if (db < 45) return 1;
  if (db < 55) return 2;
  if (db < 65) return 3;
  if (db < 75) return 4;
  return 5;
}

function suggestOverall({
  ratings,
  drinkPrice,
  foodPrice,
  workFacts,
  envFacts,
  currentSeating,
  ateFood,
}: {
  ratings: Ratings;
  drinkPrice: PriceRange | null;
  foodPrice: FoodPriceRange | null;
  workFacts: WorkFact[];
  envFacts: EnvFact[];
  currentSeating: CurrentSeating | null;
  ateFood: boolean;
}): number {
  const parts: number[] = [];
  if (ratings.wifi) parts.push(ratings.wifi);
  if (ratings.noise) parts.push(ratings.noise);
  if (ratings.seating) parts.push(ratings.seating);
  if (ratings.outlets) parts.push(ratings.outlets);
  if (ateFood && ratings.food) parts.push(ratings.food);
  const drinkV = priceValue(drinkPrice);
  if (drinkV !== null) parts.push(drinkV);
  if (ateFood) {
    const foodV = priceValue(foodPrice);
    if (foodV !== null) parts.push(foodV);
  }
  if (parts.length === 0) return 0;
  let avg = parts.reduce((a, b) => a + b, 0) / parts.length;

  // Work-friendliness adjustments
  if (workFacts.includes('stay_long')) avg += 0.3;
  if (workFacts.includes('staff_chill')) avg += 0.2;
  if (workFacts.includes('hours_ok')) avg += 0.2;
  if (workFacts.includes('good_for_focus')) avg += 0.2;
  if (workFacts.includes('forced_consumption')) avg -= 0.5;

  // Environment penalties
  if (envFacts.includes('usually_cold') && !envFacts.includes('comfortable_today')) avg -= 0.2;
  if (envFacts.includes('usually_warm') && !envFacts.includes('comfortable_today')) avg -= 0.2;

  // Current crowding penalty
  if (currentSeating === 'full' || currentSeating === 'wait') avg -= 0.2;

  return Math.max(1, Math.min(5, Math.round(avg)));
}

export function ReviewForm({ place }: { place: DemoPlace }) {
  const meta = categoryMeta(place.category);
  const needsFood = FOOD_FORWARD.has(place.category);

  const [geo, setGeo] = useState<GeoState>({ kind: 'idle' });
  const [ratings, setRatings] = useState<Ratings>(EMPTY);
  const [drinkPrice, setDrinkPrice] = useState<PriceRange | null>(null);
  const [foodPrice, setFoodPrice] = useState<FoodPriceRange | null>(null);
  const [envFacts, setEnvFacts] = useState<EnvFact[]>([]);
  const [workFacts, setWorkFacts] = useState<WorkFact[]>([]);
  const [placeType, setPlaceType] = useState<PlaceType | null>(null);
  const [currentSeating, setCurrentSeating] = useState<CurrentSeating | null>(null);
  const [overallTouched, setOverallTouched] = useState(false);
  const [wifiAutoSet, setWifiAutoSet] = useState(false);
  const [noiseAutoSet, setNoiseAutoSet] = useState(false);
  const [wifiMbps, setWifiMbps] = useState<number | null>(null);
  const [wifiLoading, setWifiLoading] = useState(false);
  const [decibel, setDecibel] = useState<number | null>(null);
  const [decibelLoading, setDecibelLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const replayedRef = useRef(false);

  const ateFood = needsFood && foodPrice !== 'did_not_eat';
  const toggleEnvFact = (fact: EnvFact) =>
    setEnvFacts((prev) => (prev.includes(fact) ? prev.filter((f) => f !== fact) : [...prev, fact]));
  const toggleWorkFact = (fact: WorkFact) =>
    setWorkFacts((prev) => (prev.includes(fact) ? prev.filter((f) => f !== fact) : [...prev, fact]));

  const suggestedOverall = suggestOverall({
    ratings,
    drinkPrice,
    foodPrice,
    workFacts,
    envFacts,
    currentSeating,
    ateFood,
  });

  // Auto-fill the overall rating when the user hasn't touched it yet.
  useEffect(() => {
    if (overallTouched) return;
    if (suggestedOverall === 0) return;
    setRatings((r) => (r.overall === suggestedOverall ? r : { ...r, overall: suggestedOverall }));
  }, [suggestedOverall, overallTouched]);

  // Restore pending draft when returning from /auth?next=/review/new/[id]?submit=review
  useEffect(() => {
    if (replayedRef.current) return;
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('submit') !== 'review') return;
    replayedRef.current = true;

    interface DraftPayload {
      overall_rating?: number;
      overall_user_set?: boolean;
      wifi_rating?: number | null;
      noise_rating?: number | null;
      seating_rating?: number | null;
      outlets_rating?: number | null;
      food_rating?: number | null;
      drink_price_range?: PriceRange | null;
      food_price_range?: FoodPriceRange | null;
      environment_facts?: EnvFact[];
      work_facts?: WorkFact[];
      place_type?: PlaceType | null;
      current_seating?: CurrentSeating | null;
      comment?: string | null;
    }

    const env = consumePending<DraftPayload>('review');
    const url = new URL(window.location.href);
    url.searchParams.delete('submit');
    window.history.replaceState(null, '', url.toString());

    if (!env || env.placeId !== place.id) return;
    const p = env.payload;
    setRatings({
      overall: p.overall_rating ?? 0,
      wifi: p.wifi_rating ?? 0,
      noise: p.noise_rating ?? 0,
      seating: p.seating_rating ?? 0,
      outlets: p.outlets_rating ?? 0,
      food: p.food_rating ?? 0,
    });
    if (p.drink_price_range) setDrinkPrice(p.drink_price_range);
    if (p.food_price_range) setFoodPrice(p.food_price_range);
    if (p.environment_facts) setEnvFacts(p.environment_facts);
    if (p.work_facts) setWorkFacts(p.work_facts);
    if (p.place_type) setPlaceType(p.place_type);
    if (p.current_seating) setCurrentSeating(p.current_seating);
    if (p.comment) setComment(p.comment);
    if (p.overall_user_set) setOverallTouched(true);
  }, [place.id]);

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
      const mbps = result.download_mbps;
      setWifiMbps(mbps);
      const auto = ratingFromMbps(mbps);
      setRatings((r) => ({ ...r, wifi: auto }));
      setWifiAutoSet(true);
    } catch {
      setWifiMbps(null);
    }
    setWifiLoading(false);
  };

  const runDecibel = async () => {
    setDecibelLoading(true);
    try {
      const result = await runDecibelTest(10);
      const db = Math.round(result.avg_db);
      setDecibel(db);
      const auto = ratingFromDb(db);
      setRatings((r) => ({ ...r, noise: auto }));
      setNoiseAutoSet(true);
    } catch {
      setDecibel(null);
    }
    setDecibelLoading(false);
  };

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit = ratings.overall > 0 && comment.length <= 280 && !submitting;

  const buildPayload = () => ({
    place_id: place.id,
    overall_rating: ratings.overall,
    overall_suggested: suggestedOverall || null,
    overall_user_set: overallTouched,
    wifi_rating: ratings.wifi || null,
    noise_rating: ratings.noise || null,
    seating_rating: ratings.seating || null,
    outlets_rating: ratings.outlets || null,
    food_rating: ateFood ? ratings.food || null : null,
    drink_price_range: drinkPrice,
    food_price_range: foodPrice,
    ate_food: ateFood,
    environment_facts: envFacts,
    work_facts: workFacts,
    place_type: placeType,
    current_seating: currentSeating,
    comment: comment.trim() || null,
    verified_lat: geo.kind === 'ok' ? geo.lat : null,
    verified_lng: geo.kind === 'ok' ? geo.lng : null,
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = buildPayload();
      const resp = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (resp.status === 401) {
        savePending('review', place.id, payload);
        const nextPath = `/review/new/${place.id}`;
        window.location.assign(buildAuthRedirect(nextPath, 'review'));
        return;
      }
      const body = (await resp.json().catch(() => ({}))) as { error?: string };
      if (!resp.ok) {
        // 404/503: table missing — preserve demo UX by acknowledging.
        if (resp.status === 404 || resp.status === 503) {
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
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-sys-gray-6"
            aria-label="Back to map"
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
            <ScaleRow
              icon="WifiHigh"
              label={wifiAutoSet && wifiMbps !== null ? `Wi-Fi · measured ${wifiMbps} Mbps` : 'Wi-Fi speed'}
              lowLabel="Slow"
              highLabel="Fast"
              value={ratings.wifi}
              onChange={(v) => {
                setWifiAutoSet(false);
                setRatings((r) => ({ ...r, wifi: v }));
              }}
            />
            <ScaleRow
              icon="SpeakerSimpleLow"
              label={noiseAutoSet && decibel !== null ? `Noise · measured ${decibel} dB` : 'Noise'}
              lowLabel="Quiet"
              highLabel="Very loud"
              value={ratings.noise}
              onChange={(v) => {
                setNoiseAutoSet(false);
                setRatings((r) => ({ ...r, noise: v }));
              }}
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
            {needsFood && ateFood && (
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
          <div className="text-[13px] font-semibold text-[var(--text-primary)]">Price</div>
          <div className="mt-3">
            <div className="text-[12px] font-medium text-[var(--text-secondary)]">Drink</div>
            <div className="mt-1 flex flex-wrap gap-2">
              {DRINK_PRICE_OPTIONS.map((opt) => (
                <Choice
                  key={opt.value}
                  label={opt.label}
                  active={drinkPrice === opt.value}
                  onClick={() => setDrinkPrice(opt.value)}
                />
              ))}
            </div>
          </div>
          <div className="mt-3">
            <div className="text-[12px] font-medium text-[var(--text-secondary)]">Food</div>
            <div className="mt-1 flex flex-wrap gap-2">
              {FOOD_PRICE_OPTIONS.map((opt) => (
                <Choice
                  key={opt.value}
                  label={opt.label}
                  active={foodPrice === opt.value}
                  onClick={() => setFoodPrice(opt.value)}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-[var(--surface-border)] bg-white p-4 shadow-card">
          <div className="text-[13px] font-semibold text-[var(--text-primary)]">Environment</div>
          <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">Pick anything that fits.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {ENV_OPTIONS.map((opt) => (
              <Choice
                key={opt.value}
                icon={opt.icon}
                label={opt.label}
                active={envFacts.includes(opt.value)}
                onClick={() => toggleEnvFact(opt.value)}
              />
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-[var(--surface-border)] bg-white p-4 shadow-card">
          <div className="text-[13px] font-semibold text-[var(--text-primary)]">Work-friendliness</div>
          <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
            Stay comfort matters more than vibes — pick whatever was true.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {WORK_OPTIONS.map((opt) => (
              <Choice
                key={opt.value}
                label={opt.label}
                active={workFacts.includes(opt.value)}
                onClick={() => toggleWorkFact(opt.value)}
              />
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-[var(--surface-border)] bg-white p-4 shadow-card">
          <div className="text-[13px] font-semibold text-[var(--text-primary)]">Right now</div>
          <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">How busy is it?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {CURRENT_SEATING_OPTIONS.map((opt) => (
              <Choice
                key={opt.value}
                label={opt.label}
                active={currentSeating === opt.value}
                onClick={() => setCurrentSeating(opt.value)}
              />
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-[var(--surface-border)] bg-white p-4 shadow-card">
          <div className="text-[13px] font-semibold text-[var(--text-primary)]">Place type</div>
          <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
            Confirm what this spot actually is — helps everyone&apos;s filters work.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PLACE_TYPE_OPTIONS.map((opt) => (
              <Choice
                key={opt.value}
                label={opt.label}
                active={placeType === opt.value}
                onClick={() => setPlaceType(opt.value)}
              />
            ))}
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

        <section className="mt-4 rounded-2xl border border-[var(--surface-border)] bg-white p-4 shadow-card">
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-[13px] font-semibold text-[var(--text-primary)]">Overall</div>
            {suggestedOverall > 0 && (
              <div className="text-[11px] text-[var(--text-tertiary)]">
                Suggested: {suggestedOverall} / 5
              </div>
            )}
          </div>
          <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
            Computed from your answers. Tap a star to adjust if it doesn&apos;t feel right.
          </p>
          <div className="mt-2">
            <StarRow
              icon="Star"
              label="Overall"
              value={ratings.overall}
              onChange={(v) => {
                setOverallTouched(true);
                setRatings((r) => ({ ...r, overall: v }));
              }}
            />
          </div>
          {overallTouched && suggestedOverall > 0 && ratings.overall !== suggestedOverall && (
            <button
              type="button"
              onClick={() => {
                setOverallTouched(false);
                setRatings((r) => ({ ...r, overall: suggestedOverall }));
              }}
              className="mt-2 text-[11px] font-medium text-accent hover:opacity-80 transition"
            >
              Reset to suggested ({suggestedOverall})
            </button>
          )}
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
              : ratings.overall === 0
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

function Choice({
  icon,
  label,
  active,
  onClick,
}: {
  icon?: PhosphorIconName;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition ${
        active
          ? 'border-transparent bg-accent text-white'
          : 'border-[var(--surface-border)] bg-white text-[var(--text-primary)] hover:bg-sys-gray-6'
      }`}
    >
      {icon && <Icon name={icon} size={14} weight={active ? 'fill' : 'regular'} />}
      <span>{label}</span>
    </button>
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
