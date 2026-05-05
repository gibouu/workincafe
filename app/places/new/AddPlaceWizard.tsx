'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icons/Icon';
import { CATEGORIES, type PlaceCategory } from '@/lib/categories';
import { useToasts } from '@/lib/store/toasts';
import { CITIES, useCity } from '@/lib/store/city';

const CATEGORY_KEYS: PlaceCategory[] = [
  'cafe',
  'bakery',
  'library',
  'coworking',
  'hotel',
  'restaurant',
  'other',
];

interface SubmittedRequest {
  name: string;
  address: string | null;
  category: PlaceCategory;
  notes: string;
  lat: number;
  lng: number;
  at: number;
}

interface Prediction {
  placeId: string;
  text: string;
  primary: string;
  secondary: string;
}

interface PlaceDetails {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  types: string[];
}

// Maps backend type strings (Google Places, Foursquare, OSM tags) onto our
// internal category enum. The same key list works for all three because we
// lowercase + check against multiple aliases.
const TYPE_TO_CATEGORY: Record<string, PlaceCategory> = {
  cafe: 'cafe',
  café: 'cafe',
  coffee_shop: 'cafe',
  'coffee shop': 'cafe',
  coffee: 'cafe',
  bakery: 'bakery',
  'shop:bakery': 'bakery',
  library: 'library',
  lodging: 'hotel',
  hotel: 'hotel',
  'tourism:hotel': 'hotel',
  restaurant: 'restaurant',
  meal_takeaway: 'restaurant',
  meal_delivery: 'restaurant',
  fast_food: 'restaurant',
  'fast food restaurant': 'restaurant',
  coworking_space: 'coworking',
  'coworking space': 'coworking',
};

function inferCategory(types: string[], current: PlaceCategory): PlaceCategory {
  for (const raw of types) {
    const t = raw.toLowerCase();
    const c = TYPE_TO_CATEGORY[t];
    if (c) return c;
  }
  return current;
}

function newSessionToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

type Step = 'find' | 'describe';
const STEP_TITLES: Record<Step, string> = {
  find: 'Find it',
  describe: 'Describe it',
};
const STEPS: Step[] = ['find', 'describe'];

export function AddPlaceWizard({
  center: centerProp,
}: {
  center: { lat: number; lng: number } | null;
}) {
  const router = useRouter();
  const showToast = useToasts((s) => s.show);
  const city = useCity((s) => s.city);
  // When the wizard wasn't opened from the map (no `?lat&lng` query params),
  // fall back to the active city's center. Without a bias, Foursquare's
  // ambiguous-name search returns 0 hits — see #11.
  const center = useMemo(
    () => centerProp ?? CITIES[city]?.center ?? null,
    [centerProp, city],
  );

  const [step, setStep] = useState<Step>('find');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<PlaceCategory>('cafe');
  const [customType, setCustomType] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<PlaceDetails | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [addressQuery, setAddressQuery] = useState('');
  const [addressPredictions, setAddressPredictions] = useState<Prediction[]>([]);
  const [addressSearching, setAddressSearching] = useState(false);
  const sessionTokenRef = useRef<string>(newSessionToken());

  // Debounced autocomplete: hits Google → Foursquare → Photon depending on
  // which keys are configured server-side. We pass lat/lng so Foursquare can
  // bias by proximity to the map center.
  useEffect(() => {
    if (picked) return;
    const q = search.trim();
    if (q.length < 2) {
      setPredictions([]);
      return;
    }
    let aborted = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q, token: sessionTokenRef.current });
        if (center) {
          params.set('lat', String(center.lat));
          params.set('lng', String(center.lng));
        }
        const resp = await fetch(`/api/places/lookup?${params.toString()}`);
        if (!resp.ok) {
          if (!aborted) setPredictions([]);
          return;
        }
        const body = (await resp.json()) as { predictions?: Prediction[] };
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
  }, [search, picked, center]);

  const onPick = async (p: Prediction) => {
    try {
      const resp = await fetch(
        `/api/places/lookup?placeId=${encodeURIComponent(p.placeId)}&token=${sessionTokenRef.current}`,
      );
      if (!resp.ok) {
        showToast('Could not load place details', { tone: 'error' });
        return;
      }
      const details = (await resp.json()) as PlaceDetails;
      setPicked(details);
      setName(details.name || p.primary || '');
      setCategory((prev) => inferCategory(details.types, prev));
      setSearch(details.name || p.primary || '');
      setPredictions([]);
    } catch {
      showToast('Could not load place details', { tone: 'error' });
    }
  };

  // Address-mode autocomplete: same endpoint with `kind=address` so Photon
  // returns streets/house numbers, not just POIs. Used as a GPS fallback —
  // the user types an address and the picked suggestion locks in lat/lng.
  useEffect(() => {
    const q = addressQuery.trim();
    if (q.length < 3) {
      setAddressPredictions([]);
      return;
    }
    let aborted = false;
    setAddressSearching(true);
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q, kind: 'address' });
        if (center) {
          params.set('lat', String(center.lat));
          params.set('lng', String(center.lng));
        }
        const resp = await fetch(`/api/places/lookup?${params.toString()}`);
        if (!resp.ok) {
          if (!aborted) setAddressPredictions([]);
          return;
        }
        const body = (await resp.json()) as { predictions?: Prediction[] };
        if (!aborted) setAddressPredictions(body.predictions ?? []);
      } catch {
        if (!aborted) setAddressPredictions([]);
      } finally {
        if (!aborted) setAddressSearching(false);
      }
    }, 300);
    return () => {
      aborted = true;
      clearTimeout(t);
    };
  }, [addressQuery, center]);

  const onPickAddress = async (p: Prediction) => {
    try {
      const resp = await fetch(
        `/api/places/lookup?placeId=${encodeURIComponent(p.placeId)}`,
      );
      if (!resp.ok) {
        showToast('Could not look up that address', { tone: 'error' });
        return;
      }
      const details = (await resp.json()) as PlaceDetails;
      // Address pick provides lat/lng + formatted address but no name —
      // keep whatever the user typed (or a sensible default).
      const display = [p.primary, p.secondary].filter(Boolean).join(', ');
      setPicked({
        ...details,
        // Override address with the prediction's display string; details
        // returns only `housenumber + street`, the prediction has the city.
        address: display || details.address,
        // Strip types so inferCategory doesn't accidentally categorize a
        // street as e.g. 'restaurant' from a stray osm tag.
        types: [],
      });
      setAddressQuery(display);
      setAddressPredictions([]);
    } catch {
      showToast('Could not look up that address', { tone: 'error' });
    }
  };

  const clearPicked = () => {
    setPicked(null);
    setPredictions([]);
    setAddressPredictions([]);
    setAddressQuery('');
  };

  const submitLat = picked?.lat ?? center?.lat ?? null;
  const submitLng = picked?.lng ?? center?.lng ?? null;
  const submitAddress = picked?.address ?? null;
  const customTrim = customType.trim();
  const canAdvance = name.trim().length > 1;
  const canSubmit =
    canAdvance &&
    submitLat !== null &&
    submitLng !== null &&
    (category !== 'other' || customTrim.length > 1);

  const stepIndex = STEPS.indexOf(step);
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  const goNext = () => {
    if (!canAdvance) return;
    setStep(STEPS[stepIndex + 1]);
  };
  const goBack = () => {
    if (isFirst) router.push('/');
    else setStep(STEPS[stepIndex - 1]);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitLat === null || submitLng === null || submitting) return;
    setSubmitting(true);
    const composedNotes =
      category === 'other' && customTrim
        ? `Type: ${customTrim}${notes.trim() ? `\n\n${notes.trim()}` : ''}`
        : notes.trim();
    const record: SubmittedRequest = {
      name: name.trim(),
      address: submitAddress,
      category,
      notes: composedNotes,
      lat: submitLat,
      lng: submitLng,
      at: Date.now(),
    };
    try {
      const key = 'wic:place-requests';
      const existing = JSON.parse(window.localStorage.getItem(key) ?? '[]') as SubmittedRequest[];
      existing.push(record);
      window.localStorage.setItem(key, JSON.stringify(existing));
    } catch {
      // demo storage failures are non-fatal
    }
    void fetch('/api/places/request', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: record.name,
        address: record.address ?? undefined,
        lat: record.lat,
        lng: record.lng,
        category: record.category,
        notes: record.notes || undefined,
      }),
    }).catch(() => null);
    showToast(`${record.name} submitted for review`);
    router.push('/');
  };

  return (
    <form
      onSubmit={onSubmit}
      className="flex min-h-dvh flex-col bg-[var(--map-bg)] pb-28"
    >
      <header className="sticky top-0 z-10 border-b border-[var(--surface-border)] bg-white/90 backdrop-blur-ios">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-sys-gray-6"
            aria-label="Back to map"
          >
            <Icon name="X" size={18} />
          </Link>
          <div className="flex flex-col items-center text-center">
            <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
              Step {stepIndex + 1} of {STEPS.length}
            </div>
            <div className="text-[14px] font-semibold text-[var(--text-primary)]">
              {STEP_TITLES[step]}
            </div>
          </div>
          <div className="w-9" />
        </div>
        <div className="mx-auto flex max-w-2xl gap-1 px-4 pb-3">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= stepIndex ? 'bg-accent' : 'bg-sys-gray-5'
              }`}
            />
          ))}
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 px-5 pt-5">
        {step === 'find' && (
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-[13px] font-semibold text-[var(--text-primary)]">
                Search for it
              </div>
              <div className="mt-1 text-[12px] text-[var(--text-secondary)]">
                Try the place name. We&apos;ll auto-fill what we know.
              </div>
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--surface-border)] bg-white px-3 py-3 focus-within:ring-2 focus-within:ring-accent">
                <Icon name="MagnifyingGlass" size={16} className="text-[var(--text-tertiary)]" />
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    if (picked) setPicked(null);
                  }}
                  placeholder="e.g. Fuwa Fuwa"
                  className="flex-1 bg-transparent text-[16px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
                  autoFocus
                />
                {searching && (
                  <Icon name="CircleNotch" size={16} className="animate-spin text-[var(--text-tertiary)]" />
                )}
              </div>
              {predictions.length > 0 && !picked && (
                <ul className="mt-2 overflow-hidden rounded-xl border border-[var(--surface-border)] bg-white shadow-card">
                  {predictions.map((p) => (
                    <li key={p.placeId}>
                      <button
                        type="button"
                        onClick={() => onPick(p)}
                        className="block w-full px-3 py-2.5 text-left hover:bg-sys-gray-6"
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
              {picked && (
                <div className="mt-2 flex items-start gap-2 rounded-xl bg-accent-tint p-3 text-[13px] text-[var(--text-primary)]">
                  <Icon name="MapPin" size={16} className="mt-0.5 text-accent" />
                  <div className="flex-1">
                    <div className="font-semibold">{picked.name}</div>
                    {picked.address && (
                      <div className="text-[var(--text-secondary)]">{picked.address}</div>
                    )}
                    <button
                      type="button"
                      onClick={clearPicked}
                      className="mt-1 text-[12px] font-medium text-accent hover:underline"
                    >
                      Not this one — search again
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[var(--surface-border)] bg-white p-4">
              <div className="text-[13px] font-semibold text-[var(--text-primary)]">
                Or type the name
              </div>
              <div className="mt-1 text-[12px] text-[var(--text-secondary)]">
                If search doesn&apos;t find it, name it yourself.
              </div>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (picked && e.target.value !== picked.name) setPicked(null);
                }}
                placeholder="Place name"
                className="mt-2 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--map-bg)] px-3 py-3 text-[16px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div className="rounded-2xl border border-[var(--surface-border)] bg-white p-4">
              <div className="text-[13px] font-semibold text-[var(--text-primary)]">
                Or use an address
              </div>
              <div className="mt-1 text-[12px] text-[var(--text-secondary)]">
                If GPS isn&apos;t working, type an address — we&apos;ll look up the
                coordinates.
              </div>
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--map-bg)] px-3 py-3 focus-within:ring-2 focus-within:ring-accent">
                <Icon name="MapPinLine" size={16} className="text-[var(--text-tertiary)]" />
                <input
                  value={addressQuery}
                  onChange={(e) => {
                    setAddressQuery(e.target.value);
                    if (picked && picked.types.length === 0) setPicked(null);
                  }}
                  placeholder="e.g. 12 rue de la Convention, Paris"
                  className="flex-1 bg-transparent text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
                />
                {addressSearching && (
                  <Icon
                    name="CircleNotch"
                    size={16}
                    className="animate-spin text-[var(--text-tertiary)]"
                  />
                )}
              </div>
              {addressPredictions.length > 0 && (
                <ul className="mt-2 overflow-hidden rounded-xl border border-[var(--surface-border)] bg-white shadow-card">
                  {addressPredictions.map((p) => (
                    <li key={p.placeId}>
                      <button
                        type="button"
                        onClick={() => onPickAddress(p)}
                        className="block w-full px-3 py-2.5 text-left hover:bg-sys-gray-6"
                      >
                        <div className="text-[14px] font-medium text-[var(--text-primary)]">
                          {p.primary || p.text}
                        </div>
                        {p.secondary && (
                          <div className="text-[11px] text-[var(--text-secondary)]">
                            {p.secondary}
                          </div>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {picked && picked.types.length === 0 && (
                <div className="mt-2 flex items-start gap-2 rounded-xl bg-accent-tint p-3 text-[12px] text-[var(--text-primary)]">
                  <Icon name="MapPin" size={14} className="mt-0.5 text-accent" />
                  <div className="flex-1">
                    <div className="font-semibold">Address locked in</div>
                    {picked.address && (
                      <div className="text-[var(--text-secondary)]">{picked.address}</div>
                    )}
                    <div className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
                      {picked.lat.toFixed(5)}, {picked.lng.toFixed(5)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'describe' && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-[var(--surface-border)] bg-white p-4">
              <div className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
                <Icon name="Storefront" size={14} />
                <span className="font-medium uppercase tracking-wide">Adding</span>
              </div>
              <div className="mt-1 text-[16px] font-semibold text-[var(--text-primary)]">
                {name.trim() || 'Untitled place'}
              </div>
              {picked?.address && (
                <div className="text-[12px] text-[var(--text-secondary)]">
                  {picked.address}
                </div>
              )}
            </div>

            <div>
              <div className="text-[13px] font-semibold text-[var(--text-primary)]">
                Category
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {CATEGORY_KEYS.map((c) => {
                  const meta = CATEGORIES[c];
                  const active = category === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-[13px] font-medium transition ${
                        active
                          ? 'border-transparent text-white'
                          : 'border-[var(--surface-border)] bg-white text-[var(--text-primary)] hover:bg-sys-gray-6'
                      }`}
                      style={active ? { background: meta.color } : undefined}
                    >
                      <Icon name={meta.icon} size={14} weight={active ? 'fill' : 'regular'} />
                      <span>{meta.label}</span>
                    </button>
                  );
                })}
              </div>
              {category === 'other' && (
                <input
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value.slice(0, 60))}
                  placeholder="What kind? e.g. brewery, museum café…"
                  className="mt-3 w-full rounded-xl border border-[var(--surface-border)] bg-white px-3 py-3 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-accent"
                />
              )}
            </div>

            <label className="block">
              <div className="text-[13px] font-semibold text-[var(--text-primary)]">
                Notes (optional)
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 280))}
                placeholder="Hours, Wi-Fi, anything a future worker should know."
                rows={4}
                className="mt-2 w-full resize-none rounded-xl border border-[var(--surface-border)] bg-white px-3 py-3 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <div className="mt-1 text-right text-[11px] text-[var(--text-tertiary)]">
                {notes.length}/280
              </div>
            </label>

            <div className="rounded-2xl bg-sys-gray-6 px-4 py-3 text-[12px] text-[var(--text-secondary)]">
              <div className="flex items-center gap-2">
                <Icon name="MapPinLine" size={14} />
                <span className="font-semibold text-[var(--text-primary)]">Location</span>
              </div>
              <div className="mt-1">
                {picked
                  ? `${picked.lat.toFixed(5)}, ${picked.lng.toFixed(5)} · ${
                      picked.types.length === 0 ? 'from typed address' : 'from search'
                    }`
                  : center
                    ? `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)} · from map center`
                    : 'No location captured. Open this from the map so we know where to drop the pin.'}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-[var(--surface-border)] bg-white/95 p-4 backdrop-blur-ios">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button
            type="button"
            onClick={goBack}
            disabled={submitting}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--surface-border)] bg-white text-[var(--text-primary)] hover:bg-sys-gray-6 disabled:opacity-60"
            aria-label={isFirst ? 'Cancel' : 'Back'}
          >
            <Icon name="ArrowLeft" size={20} />
          </button>
          <div className="flex-1">
            {isLast ? (
              <button
                type="submit"
                disabled={!canSubmit || submitting}
                className="w-full rounded-2xl bg-accent py-3.5 text-[15px] font-semibold text-white hover:opacity-90 disabled:bg-sys-gray-4 disabled:cursor-not-allowed transition"
              >
                {submitting ? 'Submitting…' : 'Submit for review'}
              </button>
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
