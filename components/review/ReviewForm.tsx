'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon, type PhosphorIconName } from '@/components/icons/Icon';
import { SliderRow } from '@/components/review/SliderRow';
import { PhotoSlots, type SlotState } from '@/components/review/PhotoSlots';
import { categoryMeta } from '@/lib/categories';
import { haversineMeters } from '@/lib/geo';
import { GEO_VERIFY_METERS } from '@/app/api/_shared/geo-check';
import { runSpeedtest, SpeedtestError, type SpeedtestPhase } from '@/lib/measurement/speedtest';
import { runDecibelTest } from '@/lib/measurement/decibel';
import type { DemoPlace } from '@/lib/demo/paris-places';
import { currencyForCountry } from '@/lib/currency';
import { savePending, consumePending, buildAuthRedirect } from '@/lib/auth/pending-submit';
import {
  priceBucketToValue,
  ratingFromDb10,
  ratingFromMbps10,
  suggestOverall,
  type WorkFact,
} from '@/lib/review/scoring';
import {
  BUSY_ANCHORS,
  COFFEE_ART_ANCHORS,
  COFFEE_MUG_ANCHORS,
  COFFEE_QUALITY_ANCHORS,
  FOOD_VALUE_ANCHORS,
  NOISE_FALLBACK_ANCHORS,
  OUTLETS_ANCHORS,
  OVERALL_ANCHORS,
  SEATING_ANCHORS,
  TEMPERATURE_ANCHORS,
  WIFI_FALLBACK_ANCHORS,
} from '@/lib/review/anchors';
import { weatherCondition } from '@/lib/weather/codes';
import { Chip } from '@/components/ui/Chip';
import { ChipRow } from '@/components/ui/ChipRow';
import { Section } from '@/components/ui/Section';
import { PHOTO_SLOTS, type PhotoSlot } from '@/lib/review/photos';

type GeoState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ok'; meters: number; lat: number; lng: number }
  | { kind: 'far'; meters: number }
  | { kind: 'denied'; message: string }
  | { kind: 'unavailable'; message: string }
  | { kind: 'timeout' }
  | { kind: 'unsupported' };

const FOOD_FORWARD = new Set(['restaurant', 'fast_food', 'fast_food_burger', 'bakery']);

type WifiState =
  | { kind: 'idle' }
  | { kind: 'measuring'; phase: SpeedtestPhase }
  | { kind: 'measured'; mbps: number; ping: number; rating: number }
  | { kind: 'failed'; phase: SpeedtestPhase; message: string };

type NoiseState =
  | { kind: 'idle' }
  | { kind: 'measuring' }
  | { kind: 'measured'; db: number; rating: number }
  | { kind: 'failed'; message: string };

type DrinkPriceBucket =
  | 'lt2'
  | '2_4'
  | '4_6'
  | '6_8'
  | '8_10'
  | '10_12'
  | '12_14'
  | '14_20'
  | 'gte20';
type FoodPriceBucket = DrinkPriceBucket | 'did_not_eat';
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

const PRICE_BUCKETS: DrinkPriceBucket[] = [
  'lt2',
  '2_4',
  '4_6',
  '6_8',
  '8_10',
  '10_12',
  '12_14',
  '14_20',
  'gte20',
];

function priceLabel(bucket: DrinkPriceBucket | 'did_not_eat', symbol: string): string {
  if (bucket === 'did_not_eat') return 'Did not eat';
  if (bucket === 'lt2') return `<${symbol}2`;
  if (bucket === 'gte20') return `${symbol}20+`;
  const [lo, hi] = bucket.split('_');
  return `${symbol}${lo}–${hi}`;
}

const WORK_OPTIONS: { value: WorkFact; label: string; icon: PhosphorIconName }[] = [
  { value: 'staff_chill', label: 'Staff chill about laptops', icon: 'HandHeart' },
  { value: 'hours_ok', label: 'Felt ok to stay several hours', icon: 'HourglassMedium' },
  { value: 'good_for_focus', label: 'Good for focused work', icon: 'Brain' },
  { value: 'good_for_calls', label: 'Good for calls', icon: 'Phone' },
  { value: 'forced_consumption', label: 'Pressured to keep ordering', icon: 'WarningCircle' },
];

const PLACE_TYPE_OPTIONS: { value: PlaceType; label: string }[] = [
  { value: 'cafe', label: 'Café' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'library', label: 'Library' },
  { value: 'coworking', label: 'Coworking' },
  { value: 'hotel_lobby', label: 'Hotel lobby' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'fast_food', label: 'Fast food' },
  { value: 'gym_workspace', label: 'Gym / club workspace' },
  { value: 'other', label: 'Other' },
];

interface WeatherInfo {
  tempC: number | null;
  condition: string | null;
}

type WizardStep =
  | 'location'
  | 'measurements'
  | 'comfort'
  | 'price'
  | 'coffee'
  | 'vibe'
  | 'photos'
  | 'final';

// Cafés get a dedicated coffee step between price and vibe so users can
// rate the actual coffee, not just the space. Non-cafés never see it. See #85.
function buildSteps(category: string): { id: WizardStep; title: string }[] {
  const baseBeforeVibe: { id: WizardStep; title: string }[] = [
    { id: 'location', title: 'Location' },
    { id: 'measurements', title: 'Measurements' },
    { id: 'comfort', title: 'Comfort' },
    { id: 'price', title: 'Price' },
  ];
  const tail: { id: WizardStep; title: string }[] = [
    { id: 'vibe', title: 'Vibe' },
    { id: 'photos', title: 'Photos' },
    { id: 'final', title: 'Overall' },
  ];
  if (category === 'cafe') {
    return [...baseBeforeVibe, { id: 'coffee', title: 'Coffee' }, ...tail];
  }
  return [...baseBeforeVibe, ...tail];
}

interface ReviewFormProps {
  place: DemoPlace;
  /** When true, the form is embedded in a parent surface (PlaceCard / FloatingPlaceCard).
   *  No page header, no place hero, navigation buttons render inline (not fixed). */
  compact?: boolean;
  /** Called when the user closes the inline review (compact mode only). */
  onClose?: () => void;
}

// Per-place draft so the user can swipe back / tap X without losing chip,
// slider, and comment state — see #14. Photos and live measurements are not
// persisted (Files can't go in localStorage; tests re-run in-session).
const REVIEW_DRAFT_PREFIX = 'wic:review-draft:';
interface ReviewDraft {
  stepIndex: number;
  seating: number;
  outlets: number;
  temperatureFeel: number;
  currentBusyness: number;
  foodValue: number;
  overall: number;
  overallTouched: boolean;
  wifiManual: number;
  noiseManual: number;
  drinkPrice: DrinkPriceBucket | null;
  foodPrice: FoodPriceBucket | null;
  didOrder: 'yes' | 'no' | null;
  workFacts: WorkFact[];
  placeType: PlaceType | null;
  comment: string;
  coffeeQuality: number;
  coffeeArt: number;
  coffeeMug: number;
  coffeeNoArt: boolean;
  coffeeNoMug: boolean;
}
function reviewDraftKey(placeId: string): string {
  return `${REVIEW_DRAFT_PREFIX}${placeId}`;
}
function loadReviewDraft(placeId: string): Partial<ReviewDraft> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(reviewDraftKey(placeId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ReviewDraft>;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}
function clearReviewDraft(placeId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(reviewDraftKey(placeId));
  } catch {
    /* noop */
  }
}

export function ReviewForm({ place, compact = false, onClose }: ReviewFormProps) {
  const meta = categoryMeta(place.category);
  const needsFood = FOOD_FORWARD.has(place.category);
  const symbol = currencyForCountry(place.country);
  // STEPS depend on category: cafés get a dedicated coffee step. See #85.
  const STEPS = useMemo(() => buildSteps(place.category), [place.category]);
  const isCafe = place.category === 'cafe';

  const [geo, setGeo] = useState<GeoState>({ kind: 'idle' });

  // Sliders
  const [seating, setSeating] = useState(0);
  const [outlets, setOutlets] = useState(0);
  const [temperatureFeel, setTemperatureFeel] = useState(0);
  const [currentBusyness, setCurrentBusyness] = useState(0);
  const [foodValue, setFoodValue] = useState(0);
  const [overall, setOverall] = useState(0);
  const [overallTouched, setOverallTouched] = useState(false);

  // Measurement-first
  const [wifi, setWifi] = useState<WifiState>({ kind: 'idle' });
  const [wifiManual, setWifiManual] = useState(0);
  const [noise, setNoise] = useState<NoiseState>({ kind: 'idle' });
  const [noiseManual, setNoiseManual] = useState(0);

  // Chips
  const [drinkPrice, setDrinkPrice] = useState<DrinkPriceBucket | null>(null);
  const [foodPrice, setFoodPrice] = useState<FoodPriceBucket | null>(null);
  const [didOrder, setDidOrder] = useState<'yes' | 'no' | null>(null);

  // Coffee step (cafés only). 0 = unset, 1–10 = rated. Opt-out booleans
  // null out the corresponding rating in the payload. See #85.
  const [coffeeQuality, setCoffeeQuality] = useState(0);
  const [coffeeArt, setCoffeeArt] = useState(0);
  const [coffeeMug, setCoffeeMug] = useState(0);
  const [coffeeNoArt, setCoffeeNoArt] = useState(false);
  const [coffeeNoMug, setCoffeeNoMug] = useState(false);

  // Multi-select work facts
  const [workFacts, setWorkFacts] = useState<WorkFact[]>([]);
  const toggleWork = (f: WorkFact) =>
    setWorkFacts((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  const [placeType, setPlaceType] = useState<PlaceType | null>(null);

  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<SlotState>({});

  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  // When the API returns 401, we *don't* redirect to /auth automatically.
  // The submit button transforms into a "Sign in to post" CTA so the user
  // has time to read the message and consciously consent to leaving the
  // page. Tapping the CTA persists the draft via savePending and routes
  // to /auth; consumePending replays the submission once they're back.
  const [needsLogin, setNeedsLogin] = useState(false);
  const replayedRef = useRef(false);

  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === STEPS.length - 1;

  // Draft restore (one-shot on mount). Photos + live measurements stay fresh.
  const draftHydratedRef = useRef(false);
  useEffect(() => {
    const draft = loadReviewDraft(place.id);
    if (draft) {
      if (typeof draft.stepIndex === 'number' && draft.stepIndex >= 0 && draft.stepIndex < STEPS.length)
        setStepIndex(draft.stepIndex);
      if (typeof draft.seating === 'number') setSeating(draft.seating);
      if (typeof draft.outlets === 'number') setOutlets(draft.outlets);
      if (typeof draft.temperatureFeel === 'number') setTemperatureFeel(draft.temperatureFeel);
      if (typeof draft.currentBusyness === 'number') setCurrentBusyness(draft.currentBusyness);
      if (typeof draft.foodValue === 'number') setFoodValue(draft.foodValue);
      if (typeof draft.overall === 'number') setOverall(draft.overall);
      if (typeof draft.overallTouched === 'boolean') setOverallTouched(draft.overallTouched);
      if (typeof draft.wifiManual === 'number') setWifiManual(draft.wifiManual);
      if (typeof draft.noiseManual === 'number') setNoiseManual(draft.noiseManual);
      if (draft.drinkPrice !== undefined) setDrinkPrice(draft.drinkPrice);
      if (draft.foodPrice !== undefined) setFoodPrice(draft.foodPrice);
      if (draft.didOrder !== undefined) setDidOrder(draft.didOrder);
      if (Array.isArray(draft.workFacts)) setWorkFacts(draft.workFacts);
      if (draft.placeType !== undefined) setPlaceType(draft.placeType);
      if (typeof draft.comment === 'string') setComment(draft.comment);
      if (typeof draft.coffeeQuality === 'number') setCoffeeQuality(draft.coffeeQuality);
      if (typeof draft.coffeeArt === 'number') setCoffeeArt(draft.coffeeArt);
      if (typeof draft.coffeeMug === 'number') setCoffeeMug(draft.coffeeMug);
      if (typeof draft.coffeeNoArt === 'boolean') setCoffeeNoArt(draft.coffeeNoArt);
      if (typeof draft.coffeeNoMug === 'boolean') setCoffeeNoMug(draft.coffeeNoMug);
    }
    draftHydratedRef.current = true;
  }, [place.id, STEPS.length]);

  // Persist on field change (after hydration).
  useEffect(() => {
    if (!draftHydratedRef.current) return;
    const hasContent =
      stepIndex > 0 ||
      comment.trim().length > 0 ||
      workFacts.length > 0 ||
      placeType !== null ||
      drinkPrice !== null ||
      foodPrice !== null ||
      didOrder !== null ||
      seating > 0 ||
      outlets > 0 ||
      temperatureFeel > 0 ||
      currentBusyness > 0 ||
      foodValue > 0 ||
      overall > 0 ||
      wifiManual > 0 ||
      noiseManual > 0;
    if (!hasContent) {
      clearReviewDraft(place.id);
      return;
    }
    try {
      const draft: ReviewDraft = {
        stepIndex,
        seating,
        outlets,
        temperatureFeel,
        currentBusyness,
        foodValue,
        overall,
        overallTouched,
        wifiManual,
        noiseManual,
        drinkPrice,
        foodPrice,
        didOrder,
        workFacts,
        placeType,
        comment,
        coffeeQuality,
        coffeeArt,
        coffeeMug,
        coffeeNoArt,
        coffeeNoMug,
      };
      window.localStorage.setItem(reviewDraftKey(place.id), JSON.stringify(draft));
    } catch {
      /* quota exceeded — non-fatal */
    }
  }, [
    place.id,
    stepIndex,
    seating,
    outlets,
    temperatureFeel,
    currentBusyness,
    foodValue,
    overall,
    overallTouched,
    wifiManual,
    noiseManual,
    drinkPrice,
    foodPrice,
    didOrder,
    workFacts,
    placeType,
    comment,
    coffeeQuality,
    coffeeArt,
    coffeeMug,
    coffeeNoArt,
    coffeeNoMug,
  ]);

  const ateFood =
    didOrder === 'yes' &&
    needsFood &&
    foodPrice !== null &&
    foodPrice !== 'did_not_eat';

  // Effective ratings used by both the suggestion and the payload
  const effectiveWifi: number | null =
    wifi.kind === 'measured' ? wifi.rating : wifi.kind === 'failed' && wifiManual > 0 ? wifiManual : null;
  const effectiveNoise: number | null =
    noise.kind === 'measured'
      ? noise.rating
      : noise.kind === 'failed' && noiseManual > 0
        ? noiseManual
        : null;

  const suggestedOverall = useMemo(
    () =>
      suggestOverall({
        wifi: effectiveWifi,
        noise: effectiveNoise,
        seating: seating || null,
        outlets: outlets || null,
        temperatureFeel: temperatureFeel || null,
        currentBusyness: currentBusyness || null,
        workFacts,
        drinkPriceValue: priceBucketToValue(drinkPrice),
        foodPriceValue: ateFood ? priceBucketToValue(foodPrice) : null,
        foodValue: ateFood && foodValue > 0 ? foodValue : null,
        ateFood,
      }),
    [
      effectiveWifi,
      effectiveNoise,
      seating,
      outlets,
      temperatureFeel,
      currentBusyness,
      workFacts,
      drinkPrice,
      foodPrice,
      foodValue,
      ateFood,
    ],
  );

  // Auto-fill the overall slider until the user touches it
  useEffect(() => {
    if (overallTouched) return;
    if (suggestedOverall === 0) return;
    setOverall(suggestedOverall);
  }, [suggestedOverall, overallTouched]);

  // Restore pending draft after returning from /auth?next=...&submit=review
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
      food_value_rating?: number | null;
      current_busyness?: number | null;
      temperature_feel?: number | null;
      drink_price_range?: DrinkPriceBucket | null;
      food_price_range?: FoodPriceBucket | null;
      ate_food?: boolean;
      work_facts?: WorkFact[];
      place_type?: PlaceType | null;
      comment?: string | null;
    }

    const env = consumePending<DraftPayload>('review');
    const url = new URL(window.location.href);
    url.searchParams.delete('submit');
    window.history.replaceState(null, '', url.toString());

    if (!env || env.placeId !== place.id) return;
    const p = env.payload;
    if (typeof p.overall_rating === 'number') setOverall(p.overall_rating);
    if (typeof p.seating_rating === 'number') setSeating(p.seating_rating);
    if (typeof p.outlets_rating === 'number') setOutlets(p.outlets_rating);
    if (typeof p.temperature_feel === 'number') setTemperatureFeel(p.temperature_feel);
    if (typeof p.current_busyness === 'number') setCurrentBusyness(p.current_busyness);
    if (typeof p.food_value_rating === 'number') setFoodValue(p.food_value_rating);
    if (typeof p.wifi_rating === 'number') {
      setWifi({ kind: 'failed', phase: 'download', message: 'Re-test or rate manually' });
      setWifiManual(p.wifi_rating);
    }
    if (typeof p.noise_rating === 'number') {
      setNoise({ kind: 'failed', message: 'Re-test or rate manually' });
      setNoiseManual(p.noise_rating);
    }
    if (p.drink_price_range) setDrinkPrice(p.drink_price_range);
    if (p.food_price_range) setFoodPrice(p.food_price_range);
    if (p.work_facts) setWorkFacts(p.work_facts);
    if (p.place_type) setPlaceType(p.place_type);
    if (p.comment) setComment(p.comment);
    if (p.overall_user_set) setOverallTouched(true);
  }, [place.id]);

  // Fetch weather for the temperature hint
  useEffect(() => {
    let aborted = false;
    fetch(`/api/weather?lat=${place.lat}&lng=${place.lng}`)
      .then((r) => r.json())
      .then((data: { temp_c?: number; weather_code?: number }) => {
        if (aborted) return;
        const condition = weatherCondition(data.weather_code ?? null);
        setWeather({
          tempC: typeof data.temp_c === 'number' ? Math.round(data.temp_c) : null,
          condition,
        });
      })
      .catch(() => null);
    return () => {
      aborted = true;
    };
  }, [place.lat, place.lng]);

  const useDevLocation = () => {
    setGeo({ kind: 'ok', meters: 0, lat: place.lat, lng: place.lng });
  };

  const requestGeo = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeo({ kind: 'unsupported' });
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
          meters <= GEO_VERIFY_METERS
            ? { kind: 'ok', meters, lat: pos.coords.latitude, lng: pos.coords.longitude }
            : { kind: 'far', meters },
        );
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeo({
            kind: 'denied',
            message:
              'Location permission blocked. Enable it in your browser settings, or open this page on your phone.',
          });
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGeo({
            kind: 'unavailable',
            message: "Couldn't get a fix. Step outside or near a window and try again.",
          });
        } else if (err.code === err.TIMEOUT) {
          setGeo({ kind: 'timeout' });
        } else {
          setGeo({ kind: 'denied', message: err.message || 'Location access denied.' });
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const runWifiTest = async () => {
    setWifi({ kind: 'measuring', phase: 'ping' });
    try {
      const result = await runSpeedtest({
        onPhase: (phase) => setWifi({ kind: 'measuring', phase }),
      });
      setWifi({
        kind: 'measured',
        mbps: result.download_mbps,
        ping: result.ping_ms,
        rating: ratingFromMbps10(result.download_mbps),
      });
    } catch (err) {
      const phase = err instanceof SpeedtestError ? err.phase : 'download';
      const message =
        err instanceof Error ? err.message : 'Speed test failed.';
      setWifi({ kind: 'failed', phase, message });
    }
  };

  const runNoiseTest = async () => {
    setNoise({ kind: 'measuring' });
    try {
      const result = await runDecibelTest(10);
      const db = Math.round(result.avg_db);
      setNoise({ kind: 'measured', db, rating: ratingFromDb10(db) });
    } catch (err) {
      const message =
        err instanceof Error
          ? /denied|permission/i.test(err.message)
            ? 'Microphone access blocked. Enable it in your browser settings, or rate manually.'
            : err.message
          : 'Noise test failed.';
      setNoise({ kind: 'failed', message });
    }
  };

  const buildPayload = () => ({
    place_id: place.id,
    overall_rating: overall,
    overall_suggested: suggestedOverall || null,
    overall_user_set: overallTouched,
    wifi_rating: effectiveWifi,
    noise_rating: effectiveNoise,
    seating_rating: seating || null,
    outlets_rating: outlets || null,
    food_value_rating: ateFood && foodValue > 0 ? foodValue : null,
    current_busyness: currentBusyness || null,
    temperature_feel: temperatureFeel || null,
    drink_price_range: drinkPrice,
    food_price_range: foodPrice,
    ate_food: ateFood,
    work_facts: workFacts,
    place_type: placeType,
    outside_temp_c: weather?.tempC ?? null,
    outside_condition: weather?.condition ?? null,
    comment: comment.trim() || null,
    verified_lat: geo.kind === 'ok' ? geo.lat : null,
    verified_lng: geo.kind === 'ok' ? geo.lng : null,
    coffee_quality_rating: isCafe && didOrder === 'yes' && coffeeQuality > 0 ? coffeeQuality : null,
    coffee_art_rating:
      isCafe && didOrder === 'yes' && !coffeeNoArt && coffeeArt > 0 ? coffeeArt : null,
    coffee_mug_rating:
      isCafe && didOrder === 'yes' && !coffeeNoMug && coffeeMug > 0 ? coffeeMug : null,
    coffee_no_art: isCafe && didOrder === 'yes' && coffeeNoArt,
    coffee_no_mug: isCafe && didOrder === 'yes' && coffeeNoMug,
  });

  const canSubmit = overall > 0 && comment.length <= 280 && geo.kind === 'ok' && !submitting;

  const advanceBlockedReason: string | null =
    step.id === 'location' && geo.kind !== 'ok'
      ? 'Verify your location to continue'
      : isLastStep && overall === 0
        ? 'Pick an overall rating to submit'
        : isLastStep && geo.kind !== 'ok'
          ? 'Verify your location to submit'
          : null;
  const canAdvance = advanceBlockedReason === null && !submitting;

  const goNext = () => {
    if (!canAdvance) return;
    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
  };
  const goBack = () => setStepIndex((i) => Math.max(0, i - 1));

  const uploadPhotos = async (reviewId: string) => {
    const slotsWithPhotos = PHOTO_SLOTS.filter((s) => Boolean(photos[s])) as PhotoSlot[];
    if (slotsWithPhotos.length === 0) return;

    const folder = `reviews/${reviewId}`;
    const uploaded: {
      slot: PhotoSlot;
      cloudinary_public_id: string;
      cloudinary_version: string;
      width: number;
      height: number;
      bytes: number;
    }[] = [];

    await Promise.all(
      slotsWithPhotos.map(async (slot) => {
        const prepared = photos[slot];
        if (!prepared) return;

        const signResp = await fetch('/api/cloudinary/sign', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ folder, public_id: slot }),
        });
        if (!signResp.ok) return;
        const sig = (await signResp.json()) as {
          signature: string;
          timestamp: number;
          api_key: string;
          cloud_name: string;
          folder: string;
          public_id?: string;
        };

        const fd = new FormData();
        fd.append('file', prepared.blob);
        fd.append('api_key', sig.api_key);
        fd.append('timestamp', String(sig.timestamp));
        fd.append('signature', sig.signature);
        fd.append('folder', sig.folder);
        if (sig.public_id) fd.append('public_id', sig.public_id);

        const upResp = await fetch(
          `https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`,
          { method: 'POST', body: fd },
        );
        if (!upResp.ok) return;
        const result = (await upResp.json()) as {
          public_id: string;
          version: number;
          width: number;
          height: number;
          bytes: number;
        };
        uploaded.push({
          slot,
          cloudinary_public_id: result.public_id,
          cloudinary_version: String(result.version),
          width: result.width ?? prepared.width,
          height: result.height ?? prepared.height,
          bytes: result.bytes ?? prepared.bytes,
        });
      }),
    );
    if (uploaded.length === 0) return;
    await fetch(`/api/reviews/${reviewId}/photos`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ photos: uploaded }),
    }).catch(() => null);
  };

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
        // Don't bounce the user out of the form mid-submit. Surface an
        // inline notice + transform the submit button into a sign-in CTA;
        // the user explicitly taps that to actually leave the page.
        setNeedsLogin(true);
        setSubmitting(false);
        return;
      }
      const body = (await resp.json().catch(() => ({}))) as { error?: string; id?: string };
      if (!resp.ok) {
        if (resp.status === 404 || resp.status === 503) {
          clearReviewDraft(place.id);
          setSubmitted(true);
          return;
        }
        throw new Error(body.error ?? `request failed (${resp.status})`);
      }
      // Fire-and-forget secondary measurements
      if (wifi.kind === 'measured') {
        void fetch('/api/wifi-tests', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            place_id: place.id,
            lat: place.lat,
            lng: place.lng,
            download_mbps: wifi.mbps,
            ping_ms: wifi.ping,
          }),
        }).catch(() => null);
      }
      if (noise.kind === 'measured') {
        void fetch('/api/decibel', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ place_id: place.id, avg_db: noise.db }),
        }).catch(() => null);
      }
      if (body.id) {
        await uploadPhotos(body.id);
      }
      clearReviewDraft(place.id);
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    if (compact) {
      return (
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-green-tint">
            <Icon name="CheckCircle" weight="fill" size={36} className="text-accent-green" />
          </div>
          <h1 className="mt-4 text-[20px] font-bold text-[var(--text-primary)]">Thanks!</h1>
          <p className="mt-1 max-w-xs text-[13px] text-[var(--text-secondary)]">
            Your review helps the next person find a good spot to work.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 rounded-2xl bg-accent px-5 py-2.5 text-[14px] font-semibold text-white hover:opacity-90 transition"
          >
            Back to place
          </button>
        </div>
      );
    }
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--map-bg)] px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-green-tint">
          <Icon name="CheckCircle" weight="fill" size={44} className="text-accent-green" />
        </div>
        <h1 className="mt-5 text-[28px] font-bold text-[var(--text-primary)]">Thanks!</h1>
        <p className="mt-2 max-w-xs text-[14px] text-[var(--text-secondary)]">
          Your review helps the next person find a good spot to work.
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
    <form
      onSubmit={onSubmit}
      className={
        compact
          ? 'flex h-full min-h-0 w-full flex-1 flex-col bg-white'
          : 'flex min-h-dvh flex-col bg-[var(--map-bg)] pb-28'
      }
    >
      <header
        className={
          compact
            ? 'shrink-0 border-b border-[var(--surface-border)] bg-white/95 backdrop-blur-ios'
            : 'sticky top-0 z-10 border-b border-[var(--surface-border)] bg-white/90 backdrop-blur-ios'
        }
      >
        <div
          className={`mx-auto flex max-w-2xl items-center justify-between ${
            compact ? 'px-3 py-2' : 'px-4 py-3'
          }`}
        >
          {compact ? (
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-sys-gray-6"
              aria-label="Close review"
            >
              <Icon name="ArrowLeft" size={16} />
            </button>
          ) : (
            <Link
              href="/"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-sys-gray-6"
              aria-label="Back to map"
            >
              <Icon name="X" size={18} />
            </Link>
          )}
          <div className="flex flex-col items-center text-center">
            <div
              className={`font-medium uppercase tracking-wide text-[var(--text-tertiary)] ${
                compact ? 'text-[10px]' : 'text-[11px]'
              }`}
            >
              Step {stepIndex + 1} of {STEPS.length}
            </div>
            <div
              className={`font-semibold text-[var(--text-primary)] ${
                compact ? 'text-[13px]' : 'text-[14px]'
              }`}
            >
              {step.title}
            </div>
          </div>
          <div className={compact ? 'w-8' : 'w-9'} />
        </div>
        <div
          className={`mx-auto flex max-w-2xl gap-1 ${
            compact ? 'px-3 pb-2' : 'px-4 pb-3'
          }`}
        >
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= stepIndex ? 'bg-accent' : 'bg-sys-gray-5'
              }`}
            />
          ))}
        </div>
      </header>

      <div
        className={`mx-auto w-full max-w-2xl ${
          compact ? 'min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-4' : 'flex-1 px-5 pt-5'
        }`}
      >
        {!compact && (
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-white shadow-bubble"
              style={{ background: meta.color }}
            >
              <Icon name={meta.icon} size={18} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold text-[var(--text-primary)]">
                {place.name}
              </div>
              <div className="truncate text-[11px] text-[var(--text-secondary)]">
                {place.address} · {place.neighborhood}
              </div>
            </div>
          </div>
        )}

        {step.id === 'location' && (
          <GeoBanner
            geo={geo}
            placeName={place.name}
            onRequest={requestGeo}
            onDevSkip={process.env.NODE_ENV !== 'production' ? useDevLocation : undefined}
          />
        )}

        {step.id === 'measurements' && (
          <>
            <Section
              title="Wi-Fi"
              subtitle="We measure it. Rate manually if the test fails."
            >
              <MeasureCard
                icon="WifiHigh"
                label="Test Wi-Fi speed"
                description="Parallel download + upload. ~16 s."
                state={wifi}
                onRun={runWifiTest}
              />
              {wifi.kind === 'failed' && (
                <div className="mt-3">
                  <div className="rounded-xl bg-accent-red-tint px-3 py-2 text-[12px] text-accent-red">
                    {wifi.message}
                  </div>
                  <div className="mt-2">
                    <SliderRow
                      icon="WifiHigh"
                      label="Rate Wi-Fi manually"
                      value={wifiManual}
                      onChange={setWifiManual}
                      anchors={WIFI_FALLBACK_ANCHORS}
                      endLabels={{ low: 'Unusable', high: 'Fiber' }}
                    />
                  </div>
                </div>
              )}
            </Section>
            <Section
              title="Noise"
              subtitle="We sample 10 s of ambient sound. Audio never leaves your device."
            >
              <MeasureNoiseCard state={noise} onRun={runNoiseTest} />
              {noise.kind === 'failed' && (
                <div className="mt-3">
                  <div className="rounded-xl bg-accent-red-tint px-3 py-2 text-[12px] text-accent-red">
                    {noise.message}
                  </div>
                  <div className="mt-2">
                    <SliderRow
                      icon="SpeakerSimpleHigh"
                      label="Rate noise manually"
                      value={noiseManual}
                      onChange={setNoiseManual}
                      anchors={NOISE_FALLBACK_ANCHORS}
                      endLabels={{ low: 'Loud', high: 'Library-quiet' }}
                    />
                  </div>
                </div>
              )}
            </Section>
          </>
        )}

        {step.id === 'comfort' && (
          <Section title="Comfort & environment">
            <SliderRow
              icon="Armchair"
              label="Seating comfort"
              value={seating}
              onChange={setSeating}
              anchors={SEATING_ANCHORS}
              endLabels={{ low: 'Wooden stool', high: 'Sofa lounge' }}
            />
            <SliderRow
              icon="Plug"
              label="Outlets / plugs"
              value={outlets}
              onChange={setOutlets}
              anchors={OUTLETS_ANCHORS}
              endLabels={{ low: 'None', high: 'Every seat' }}
            />
            <SliderRow
              icon="Thermometer"
              label="Temperature"
              value={temperatureFeel}
              onChange={setTemperatureFeel}
              anchors={TEMPERATURE_ANCHORS}
              endLabels={{ low: 'Cold', high: 'Hot' }}
            />
            <SliderRow
              icon="Users"
              label="Busy right now"
              value={currentBusyness}
              onChange={setCurrentBusyness}
              anchors={BUSY_ANCHORS}
              endLabels={{ low: 'Empty', high: 'Packed' }}
            />
          </Section>
        )}

        {step.id === 'price' && (
          <>
            <Section title="Did you order anything here?">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDidOrder('yes')}
                  className={`rounded-2xl border px-3 py-3 text-[14px] font-semibold transition ${
                    didOrder === 'yes'
                      ? 'border-transparent bg-accent text-white'
                      : 'border-[var(--surface-border)] bg-white text-[var(--text-primary)] hover:bg-sys-gray-6'
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDidOrder('no');
                    setDrinkPrice(null);
                    setFoodPrice(null);
                  }}
                  className={`rounded-2xl border px-3 py-3 text-[14px] font-semibold transition ${
                    didOrder === 'no'
                      ? 'border-transparent bg-accent text-white'
                      : 'border-[var(--surface-border)] bg-white text-[var(--text-primary)] hover:bg-sys-gray-6'
                  }`}
                >
                  No, just used the space
                </button>
              </div>
            </Section>
            {didOrder === 'yes' && (
              <>
                <Section
                  title="Price for a drink"
                  subtitle="Pick the bucket your usual order falls in."
                >
                  <ChipRow>
                    {PRICE_BUCKETS.map((bucket) => (
                      <Chip
                        key={bucket}
                        label={priceLabel(bucket, symbol)}
                        active={drinkPrice === bucket}
                        onClick={() => setDrinkPrice(bucket)}
                      />
                    ))}
                  </ChipRow>
                </Section>
                {needsFood && (
                  <Section title="Food">
                    <ChipRow>
                      <Chip
                        label="Did not eat"
                        active={foodPrice === 'did_not_eat'}
                        onClick={() => setFoodPrice('did_not_eat')}
                      />
                      {PRICE_BUCKETS.map((bucket) => (
                        <Chip
                          key={bucket}
                          label={priceLabel(bucket, symbol)}
                          active={foodPrice === bucket}
                          onClick={() => setFoodPrice(bucket)}
                        />
                      ))}
                    </ChipRow>
                    {ateFood && (
                      <div className="mt-3">
                        <SliderRow
                          icon="ForkKnife"
                          label="Portion / value"
                          value={foodValue}
                          onChange={setFoodValue}
                          anchors={FOOD_VALUE_ANCHORS}
                          endLabels={{ low: 'Overpriced', high: 'Great value' }}
                        />
                      </div>
                    )}
                  </Section>
                )}
              </>
            )}
            {didOrder === 'no' && (
              <Section title="Got it">
                <p className="text-[12px] text-[var(--text-secondary)]">
                  We’ll skip the price questions.
                </p>
              </Section>
            )}
          </>
        )}

        {step.id === 'coffee' && (
          <>
            {didOrder === 'yes' ? (
              <>
                <Section
                  title="The coffee itself"
                  subtitle="Rate the actual drink — quality matters most. Art and mug are bonuses."
                >
                  <SliderRow
                    icon="Coffee"
                    label="Coffee quality"
                    value={coffeeQuality}
                    onChange={setCoffeeQuality}
                    anchors={COFFEE_QUALITY_ANCHORS}
                    endLabels={{ low: 'Bad', high: 'Exceptional' }}
                  />
                </Section>
                <Section title="Latte art">
                  {coffeeNoArt ? (
                    <div className="rounded-2xl border border-[var(--surface-border)] bg-white px-3 py-3 text-[12px] text-[var(--text-secondary)]">
                      Marked as no art served — we’ll skip the rating.
                    </div>
                  ) : (
                    <SliderRow
                      icon="Heart"
                      label="How nice was the art"
                      value={coffeeArt}
                      onChange={setCoffeeArt}
                      anchors={COFFEE_ART_ANCHORS}
                      endLabels={{ low: 'Blob', high: 'Showpiece' }}
                    />
                  )}
                  <div className="mt-2">
                    <Chip
                      label="No art served"
                      active={coffeeNoArt}
                      onClick={() => {
                        setCoffeeNoArt((v) => {
                          const next = !v;
                          if (next) setCoffeeArt(0);
                          return next;
                        });
                      }}
                    />
                  </div>
                </Section>
                <Section title="The mug">
                  {coffeeNoMug ? (
                    <div className="rounded-2xl border border-[var(--surface-border)] bg-white px-3 py-3 text-[12px] text-[var(--text-secondary)]">
                      Marked as a to-go cup — we’ll skip the rating.
                    </div>
                  ) : (
                    <SliderRow
                      icon="Drop"
                      label="How was the mug"
                      value={coffeeMug}
                      onChange={setCoffeeMug}
                      anchors={COFFEE_MUG_ANCHORS}
                      endLabels={{ low: 'Sad', high: 'Distinctive' }}
                    />
                  )}
                  <div className="mt-2">
                    <Chip
                      label="To-go cup / no mug"
                      active={coffeeNoMug}
                      onClick={() => {
                        setCoffeeNoMug((v) => {
                          const next = !v;
                          if (next) setCoffeeMug(0);
                          return next;
                        });
                      }}
                    />
                  </div>
                </Section>
              </>
            ) : (
              <Section title="Skipping coffee">
                <p className="text-[12px] text-[var(--text-secondary)]">
                  You said you didn’t order — we’ll skip the coffee rating.
                </p>
              </Section>
            )}
          </>
        )}

        {step.id === 'vibe' && (
          <>
            <Section
              title="Place type"
              subtitle="Confirm what this spot actually is — helps everyone’s filters work."
            >
              <div className="flex flex-wrap gap-2">
                {PLACE_TYPE_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.value}
                    label={opt.label}
                    active={placeType === opt.value}
                    onClick={() => setPlaceType(opt.value)}
                  />
                ))}
              </div>
            </Section>
            <Section
              title="Work-friendliness"
              subtitle="Pick everything that was true — multiple ok."
            >
              <div className="space-y-2">
                {WORK_OPTIONS.map((opt) => {
                  const active = workFacts.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleWork(opt.value)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                        active
                          ? 'border-accent bg-accent-tint'
                          : 'border-[var(--surface-border)] bg-white hover:bg-sys-gray-6'
                      }`}
                      aria-pressed={active}
                    >
                      <Icon
                        name={active ? 'CheckSquare' : 'Square'}
                        weight={active ? 'fill' : 'regular'}
                        size={22}
                        className={active ? 'text-accent' : 'text-[var(--text-tertiary)]'}
                      />
                      <Icon
                        name={opt.icon}
                        size={18}
                        className="text-[var(--text-secondary)]"
                      />
                      <span className="text-[14px] text-[var(--text-primary)]">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </Section>
          </>
        )}

        {step.id === 'photos' && (
          <Section
            title="Photos"
            subtitle="Up to 4. Each slot has a specific job — please don’t fill all four with food and coffee."
          >
            <PhotoSlots value={photos} onChange={setPhotos} />
            <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
              Photos are optional. They’re saved with your review after submit.
            </p>
          </Section>
        )}

        {step.id === 'final' && (
          <>
            <Section title="Overall rating">
              {suggestedOverall > 0 && !overallTouched && (
                <p className="text-[11px] text-[var(--text-tertiary)]">
                  Suggested: {suggestedOverall} / 10 — adjust if it doesn’t feel right.
                </p>
              )}
              <SliderRow
                icon="Star"
                label="Overall"
                value={overall}
                onChange={(v) => {
                  setOverallTouched(true);
                  setOverall(v);
                }}
                anchors={OVERALL_ANCHORS}
                endLabels={{ low: 'Avoid', high: 'Top-tier' }}
              />
              {overallTouched && suggestedOverall > 0 && overall !== suggestedOverall && (
                <button
                  type="button"
                  onClick={() => {
                    setOverallTouched(false);
                    setOverall(suggestedOverall);
                  }}
                  className="mt-1 text-[11px] font-medium text-accent hover:opacity-80 transition"
                >
                  Reset to suggested ({suggestedOverall})
                </button>
              )}
            </Section>
            <Section title="Comment">
              <div className="flex items-center justify-between text-[11px] text-[var(--text-tertiary)]">
                <span>Anything a future worker should know?</span>
                <span>{comment.length}/280</span>
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 280))}
                placeholder="Outlets near the window, music gets loud after 4pm, etc."
                rows={4}
                className="mt-2 w-full resize-none rounded-xl border border-[var(--surface-border)] bg-[var(--map-bg)] px-3 py-2 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </Section>
          </>
        )}
      </div>

      <div
        className={
          compact
            ? 'shrink-0 border-t border-[var(--surface-border)] bg-white/95 px-4 py-3 backdrop-blur-ios'
            : 'fixed bottom-0 left-0 right-0 z-20 border-t border-[var(--surface-border)] bg-white/95 p-4 backdrop-blur-ios'
        }
      >
        <div
          className={`mx-auto flex max-w-2xl items-center ${compact ? 'gap-2' : 'gap-3'}`}
        >
          {!isFirstStep && (
            <button
              type="button"
              onClick={goBack}
              disabled={submitting}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--surface-border)] bg-white text-[var(--text-primary)] hover:bg-sys-gray-6 disabled:opacity-60"
              aria-label="Back"
            >
              <Icon name="ArrowLeft" size={20} />
            </button>
          )}
          <div className="flex-1">
            {submitError && (
              <div className="mb-2 rounded-xl bg-accent-red-tint p-2 text-center text-[12px] text-accent-red">
                {submitError}
              </div>
            )}
            {needsLogin && (
              <div className="mb-2 rounded-xl bg-accent-amber-tint px-3 py-2.5 text-[12px] leading-snug text-[var(--text-primary)]">
                Sorry — you need to sign in to post a review. Tap below to
                sign in; we&rsquo;ll submit your review automatically right
                after. You can edit it later from your profile.
              </div>
            )}
            {advanceBlockedReason && !needsLogin && (
              <div className="mb-2 text-center text-[11px] text-[var(--text-tertiary)]">
                {advanceBlockedReason}
              </div>
            )}
            {isLastStep ? (
              needsLogin ? (
                <button
                  type="button"
                  onClick={() => {
                    // Persist the draft and route through /auth — the existing
                    // consumePending replay path picks it up after the user
                    // returns and submits transparently.
                    savePending('review', place.id, buildPayload());
                    const nextPath = `/review/new/${place.id}`;
                    window.location.assign(buildAuthRedirect(nextPath, 'review'));
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 text-[15px] font-semibold text-white hover:opacity-90 transition"
                >
                  <Icon name="SignIn" size={16} weight="fill" />
                  <span>Sign in to post your review</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full rounded-2xl bg-accent py-3.5 text-[15px] font-semibold text-white hover:opacity-90 disabled:bg-sys-gray-4 disabled:cursor-not-allowed transition"
                >
                  {submitting ? 'Submitting…' : 'Submit review'}
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={goNext}
                disabled={!canAdvance}
                className="w-full rounded-2xl bg-accent py-3.5 text-[15px] font-semibold text-white hover:opacity-90 disabled:bg-sys-gray-4 disabled:cursor-not-allowed transition"
              >
                Continue
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}

function GeoBanner({
  geo,
  placeName,
  onRequest,
  onDevSkip,
}: {
  geo: GeoState;
  placeName: string;
  onRequest: () => void;
  onDevSkip?: () => void;
}) {
  const devSkipLink = onDevSkip ? (
    <button
      type="button"
      onClick={onDevSkip}
      className="self-start text-[11px] font-medium text-[var(--text-tertiary)] underline hover:text-[var(--text-secondary)]"
    >
      Use place location (dev only)
    </button>
  ) : null;

  if (geo.kind === 'idle') {
    const isInsecure =
      typeof window !== 'undefined' && window.isSecureContext === false;
    return (
      <div className="mt-5 flex flex-col gap-2 rounded-2xl border border-[var(--surface-border)] bg-white px-4 py-3">
        <div className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
          <Icon name="MapPinLine" size={16} />
          <span>Reviews require being within {GEO_VERIFY_METERS} m of the place.</span>
        </div>
        <button
          type="button"
          onClick={onRequest}
          className="self-start rounded-xl bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 transition"
        >
          Use my location
        </button>
        {isInsecure && (
          <div className="text-[11px] text-accent-amber">
            Location requires a secure (https) page.
          </div>
        )}
        {devSkipLink}
      </div>
    );
  }
  if (geo.kind === 'checking') {
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
        <span>You’re here ({Math.round(geo.meters)} m away).</span>
      </div>
    );
  }
  if (geo.kind === 'far') {
    return (
      <div className="mt-5 flex flex-col gap-2 rounded-2xl bg-accent-amber-tint px-4 py-3 text-[13px] text-accent-amber">
        <div className="flex items-center gap-2">
          <Icon name="Info" size={16} weight="fill" />
          <span>
            You’re {(geo.meters / 1000).toFixed(1)} km from {placeName}. Reviews require being within
            {' '}{GEO_VERIFY_METERS} m.
          </span>
        </div>
        <button
          type="button"
          onClick={onRequest}
          className="self-start rounded-xl bg-white/80 px-3 py-1.5 text-[12px] font-semibold text-accent-amber hover:bg-white"
        >
          Try again
        </button>
        {devSkipLink}
      </div>
    );
  }
  if (geo.kind === 'timeout' || geo.kind === 'unavailable') {
    const message =
      geo.kind === 'timeout'
        ? 'That took too long. Try again?'
        : geo.message;
    return (
      <div className="mt-5 flex flex-col gap-2 rounded-2xl bg-accent-amber-tint px-4 py-3 text-[13px] text-accent-amber">
        <div className="flex items-center gap-2">
          <Icon name="Warning" size={16} weight="fill" />
          <span>{message}</span>
        </div>
        <button
          type="button"
          onClick={onRequest}
          className="self-start rounded-xl bg-white/80 px-3 py-1.5 text-[12px] font-semibold text-accent-amber hover:bg-white"
        >
          Retry
        </button>
        {devSkipLink}
      </div>
    );
  }
  if (geo.kind === 'unsupported') {
    return (
      <div className="mt-5 flex flex-col gap-2 rounded-2xl bg-accent-red-tint px-4 py-3 text-[13px] text-accent-red">
        <div className="flex items-center gap-2">
          <Icon name="Warning" size={16} weight="fill" />
          <span>This browser doesn’t support location. Open in Safari or Chrome on your phone.</span>
        </div>
        {devSkipLink}
      </div>
    );
  }
  return (
    <div className="mt-5 flex flex-col gap-2 rounded-2xl bg-accent-red-tint px-4 py-3 text-[13px] text-accent-red">
      <div className="flex items-center gap-2">
        <Icon name="Warning" size={16} weight="fill" />
        <span>{geo.message}</span>
      </div>
      <button
        type="button"
        onClick={onRequest}
        className="self-start rounded-xl bg-white/80 px-3 py-1.5 text-[12px] font-semibold text-accent-red hover:bg-white"
      >
        Retry
      </button>
      {devSkipLink}
    </div>
  );
}

function MeasureCard({
  icon,
  label,
  description,
  state,
  onRun,
}: {
  icon: PhosphorIconName;
  label: string;
  description: string;
  state: WifiState;
  onRun: () => void;
}) {
  const phaseCopy =
    state.kind === 'measuring'
      ? state.phase === 'ping'
        ? 'Pinging…'
        : state.phase === 'download'
          ? 'Measuring download (~8 s)…'
          : 'Measuring upload (~6 s)…'
      : null;
  return (
    <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--map-bg)] p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-bubble">
          <Icon
            name={state.kind === 'measuring' ? 'CircleNotch' : icon}
            size={20}
            className={state.kind === 'measuring' ? 'animate-spin text-accent' : 'text-accent'}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-[var(--text-primary)]">{label}</div>
          <div className="text-[11px] text-[var(--text-tertiary)]">{description}</div>
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={state.kind === 'measuring'}
          className="rounded-xl bg-accent px-3 py-2 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {state.kind === 'measured' ? 'Re-test' : state.kind === 'measuring' ? 'Running…' : 'Run test'}
        </button>
      </div>
      {phaseCopy && (
        <div className="mt-3 text-[12px] text-[var(--text-secondary)]">{phaseCopy}</div>
      )}
      {state.kind === 'measured' && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="Speed" value={`${state.mbps} Mbps`} />
          <Stat label="Ping" value={`${state.ping} ms`} />
          <Stat label="Rating" value={`${state.rating} / 10`} />
        </div>
      )}
    </div>
  );
}

function MeasureNoiseCard({
  state,
  onRun,
}: {
  state: NoiseState;
  onRun: () => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--map-bg)] p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-bubble">
          <Icon
            name={state.kind === 'measuring' ? 'CircleNotch' : 'SpeakerSimpleHigh'}
            size={20}
            className={state.kind === 'measuring' ? 'animate-spin text-accent' : 'text-accent'}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-[var(--text-primary)]">Test ambient noise</div>
          <div className="text-[11px] text-[var(--text-tertiary)]">
            10 s sample. Audio stays on your device.
          </div>
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={state.kind === 'measuring'}
          className="rounded-xl bg-accent px-3 py-2 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {state.kind === 'measured' ? 'Re-test' : state.kind === 'measuring' ? 'Listening…' : 'Run test'}
        </button>
      </div>
      {state.kind === 'measuring' && (
        <div className="mt-3 text-[12px] text-[var(--text-secondary)]">Listening…</div>
      )}
      {state.kind === 'measured' && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <Stat label="Avg" value={`${state.db} dB`} />
          <Stat label="Rating" value={`${state.rating} / 10`} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">{label}</div>
      <div className="text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">{value}</div>
    </div>
  );
}
