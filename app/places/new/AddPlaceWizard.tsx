'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icons/Icon';
import { CATEGORIES, type PlaceCategory } from '@/lib/categories';
import { useToasts } from '@/lib/store/toasts';
import { readCachedPosition } from '@/lib/geolocate';
import { savePending, buildAuthRedirect } from '@/lib/auth/pending-submit';

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

// Persisted draft so tapping the X (or accidentally swiping back) doesn't
// drop the wizard's contents — see #14.
const DRAFT_KEY = 'wic:place-new-draft';
interface WizardDraft {
  step: Step;
  name: string;
  category: PlaceCategory;
  customType: string;
  notes: string;
  search: string;
  picked: PlaceDetails | null;
  addressQuery: string;
}
function loadDraft(): WizardDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WizardDraft>;
    if (typeof parsed !== 'object' || parsed === null) return null;
    return {
      step: parsed.step === 'describe' ? 'describe' : 'find',
      name: typeof parsed.name === 'string' ? parsed.name : '',
      category:
        typeof parsed.category === 'string' && CATEGORY_KEYS.includes(parsed.category as PlaceCategory)
          ? (parsed.category as PlaceCategory)
          : 'cafe',
      customType: typeof parsed.customType === 'string' ? parsed.customType : '',
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
      search: typeof parsed.search === 'string' ? parsed.search : '',
      picked:
        parsed.picked &&
        typeof parsed.picked === 'object' &&
        typeof (parsed.picked as PlaceDetails).lat === 'number' &&
        typeof (parsed.picked as PlaceDetails).lng === 'number'
          ? (parsed.picked as PlaceDetails)
          : null,
      addressQuery: typeof parsed.addressQuery === 'string' ? parsed.addressQuery : '',
    };
  } catch {
    return null;
  }
}
function clearDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* noop */
  }
}

export function AddPlaceWizard({
  center: centerProp,
  bbox: bboxProp = null,
}: {
  center: { lat: number; lng: number } | null;
  bbox?: [number, number, number, number] | null;
}) {
  const router = useRouter();
  const showToast = useToasts((s) => s.show);
  // When the wizard wasn't opened from the map (no `?lat&lng` query params),
  // fall back to the user's last known browser geolocation. Without a bias,
  // Foursquare's ambiguous-name search returns 0 hits — see #11. If neither
  // is available we still let the user submit (search just gets fewer hits).
  const center = useMemo(() => {
    if (centerProp) return centerProp;
    if (typeof window === 'undefined') return null;
    const cached = readCachedPosition();
    return cached ? { lat: cached.lat, lng: cached.lng } : null;
  }, [centerProp]);
  // Bbox flows through to autocomplete so Foursquare/Photon results are
  // bounded to what the user can actually see on the map. #134.
  const bboxParam = bboxProp ? bboxProp.join(',') : '';
  const nameInputRef = useRef<HTMLInputElement>(null);

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
  const [draftHydrated, setDraftHydrated] = useState(false);
  const sessionTokenRef = useRef<string>(newSessionToken());

  // "Did you mean…?" duplicate-detection state. After the user picks an
  // address or a place from search, we hit /api/places/nearby-with-name
  // and surface up to ~5 existing rows so they can confirm an existing
  // place rather than file a duplicate place_request. See #82.
  interface NearbyMatch {
    id: string;
    name: string;
    category: PlaceCategory | string;
    brand: string | null;
    lat: number;
    lng: number;
    similarity: number;
  }
  const [nearbyMatches, setNearbyMatches] = useState<NearbyMatch[]>([]);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [reviewPromptForId, setReviewPromptForId] = useState<string | null>(null);

  // Restore prior draft on first mount so navigating away (X) doesn't lose
  // work. Setting state after `useState` means inputs flash empty for one
  // render — acceptable for an MVP draft.
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      // SSR-safe one-shot draft restore; a lazy init would read localStorage
      // during the first client render and mismatch the SSR HTML (#171).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep(draft.step);
      setName(draft.name);
      setCategory(draft.category);
      setCustomType(draft.customType);
      setNotes(draft.notes);
      setSearch(draft.search);
      setPicked(draft.picked);
      setAddressQuery(draft.addressQuery);
      const hadContent =
        draft.name.trim().length > 0 ||
        draft.notes.trim().length > 0 ||
        draft.customType.trim().length > 0 ||
        draft.search.trim().length > 0 ||
        draft.addressQuery.trim().length > 0 ||
        draft.picked !== null;
      if (hadContent) showToast('Draft restored', { tone: 'info' });
    }
    setDraftHydrated(true);
    // showToast is stable from zustand; not in deps to avoid re-running.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on any field change once the draft has been hydrated. Skip the
  // first render so we don't immediately overwrite stored state with empties.
  useEffect(() => {
    if (!draftHydrated) return;
    const hasContent =
      name.trim().length > 0 ||
      notes.trim().length > 0 ||
      customType.trim().length > 0 ||
      search.trim().length > 0 ||
      addressQuery.trim().length > 0 ||
      picked !== null;
    if (!hasContent) {
      clearDraft();
      return;
    }
    try {
      const draft: WizardDraft = {
        step,
        name,
        category,
        customType,
        notes,
        search,
        picked,
        addressQuery,
      };
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* quota exceeded etc. — non-fatal */
    }
  }, [draftHydrated, step, name, category, customType, notes, search, picked, addressQuery]);

  // Debounced autocomplete: hits Google → Foursquare → Photon depending on
  // which keys are configured server-side. We pass lat/lng so Foursquare can
  // bias by proximity to the map center.
  useEffect(() => {
    if (picked) return;
    const q = search.trim();
    if (q.length < 2) {
      // Debounced-fetch effect: clearing stale predictions on a too-short
      // query is the correct external sync, not a render-cascade bug.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
        if (bboxParam) params.set('bbox', bboxParam);
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
  }, [search, picked, center, bboxParam]);

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
      // Debounced-fetch effect: clearing stale predictions on a too-short
      // query is the correct external sync, not a render-cascade bug.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
        if (bboxParam) params.set('bbox', bboxParam);
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
  }, [addressQuery, center, bboxParam]);

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

  // Fetch "Did you mean…?" candidates when the user has both a name and
  // coordinates. Debounced so quick edits don't spam the endpoint. The API
  // soft-fails to empty array on missing tables, so the wizard keeps
  // working in demo mode. See #82.
  const matchQuery = (picked?.name ?? name).trim();
  const matchLat = picked?.lat ?? null;
  const matchLng = picked?.lng ?? null;
  useEffect(() => {
    if (!matchQuery || matchQuery.length < 3 || matchLat === null || matchLng === null) {
      // Debounced-fetch effect: clearing stale matches when the query is
      // incomplete is the correct external sync, not a render-cascade bug.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNearbyMatches([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      const url = `/api/places/nearby-with-name?lat=${matchLat}&lng=${matchLng}&q=${encodeURIComponent(matchQuery)}&radius_m=150`;
      fetch(url, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { matches: [] }))
        .then((data: { matches?: NearbyMatch[] }) => {
          setNearbyMatches(Array.isArray(data.matches) ? data.matches.slice(0, 5) : []);
        })
        .catch(() => null);
    }, 300);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [matchQuery, matchLat, matchLng]);

  const handleValidateMatch = async (match: NearbyMatch) => {
    if (validatingId) return;
    setValidatingId(match.id);
    try {
      const resp = await fetch(`/api/places/${encodeURIComponent(match.id)}/validate`, {
        method: 'POST',
      });
      if (resp.status === 401) {
        // Save the target id and bounce through OAuth. The map page picks
        // it up from `consumePending('validate')` after the redirect.
        savePending('validate', match.id, { placeId: match.id });
        clearDraft();
        window.location.assign(buildAuthRedirect('/', 'validate'));
        return;
      }
      if (resp.ok || resp.status === 503) {
        showToast('Got it — added to the map', { tone: 'info' });
        setReviewPromptForId(match.id);
        return;
      }
      showToast('Could not confirm the place', { tone: 'error' });
    } catch {
      showToast('Could not confirm the place', { tone: 'error' });
    } finally {
      setValidatingId(null);
    }
  };

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
    clearDraft();
    showToast(`${record.name} submitted for review`);
    router.push('/');
  };

  return (
    <form
      onSubmit={onSubmit}
      className="flex min-h-dvh flex-col bg-(--map-bg) pb-28"
    >
      <header className="sticky top-0 z-10 border-b border-(--surface-border) bg-white/90 backdrop-blur-ios">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-sys-gray-6"
            aria-label="Back to map"
          >
            <Icon name="X" size={18} />
          </Link>
          <div className="flex flex-col items-center text-center">
            <div className="text-[11px] font-medium uppercase tracking-wide text-(--text-tertiary)">
              Step {stepIndex + 1} of {STEPS.length}
            </div>
            <div className="text-[14px] font-semibold text-(--text-primary)">
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
              <div className="text-[13px] font-semibold text-(--text-primary)">
                Search for it
              </div>
              <div className="mt-1 text-[12px] text-(--text-secondary)">
                Try the place name. We&apos;ll auto-fill what we know.
              </div>
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-(--surface-border) bg-white px-3 py-3 focus-within:ring-2 focus-within:ring-accent">
                <Icon name="MagnifyingGlass" size={16} className="text-(--text-tertiary)" />
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    if (picked) setPicked(null);
                  }}
                  placeholder="e.g. Fuwa Fuwa"
                  className="flex-1 bg-transparent text-[16px] text-(--text-primary) placeholder:text-(--text-tertiary) focus:outline-hidden"
                  autoFocus
                />
                {searching && (
                  <Icon name="CircleNotch" size={16} className="animate-spin text-(--text-tertiary)" />
                )}
              </div>
              {search.trim().length >= 2 && !picked && (
                <ul className="mt-2 max-h-[244px] overflow-y-auto rounded-xl border border-(--surface-border) bg-white shadow-card">
                  {/* Always-on "I don't see it" CTA at the top — gives the
                      user an immediate fall-through to manual entry when
                      the autocomplete returns the wrong place (or none).
                      #134. */}
                  <li className="border-b border-(--surface-border) bg-(--map-bg)">
                    <button
                      type="button"
                      onClick={() => {
                        setPredictions([]);
                        setName(search);
                        // Defer focus so the click handler unwinds first.
                        setTimeout(() => nameInputRef.current?.focus(), 0);
                        nameInputRef.current?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'center',
                        });
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-sys-gray-6"
                    >
                      <Icon name="Plus" size={14} className="text-accent" />
                      <div>
                        <div className="text-[14px] font-semibold text-accent">
                          I don&apos;t see it — type the name
                        </div>
                        <div className="text-[12px] text-(--text-secondary)">
                          {predictions.length === 0
                            ? 'No matches found in our index'
                            : 'None of these are the right place'}
                        </div>
                      </div>
                    </button>
                  </li>
                  {predictions.map((p) => (
                    <li key={p.placeId}>
                      <button
                        type="button"
                        onClick={() => onPick(p)}
                        className="block w-full px-3 py-2.5 text-left hover:bg-sys-gray-6"
                      >
                        <div className="text-[15px] font-medium text-(--text-primary)">
                          {p.primary || p.text}
                        </div>
                        {p.secondary && (
                          <div className="text-[12px] text-(--text-secondary)">
                            {p.secondary}
                          </div>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {picked && (
                <div className="mt-2 flex items-start gap-2 rounded-xl bg-accent-tint p-3 text-[13px] text-(--text-primary)">
                  <Icon name="MapPin" size={16} className="mt-0.5 text-accent" />
                  <div className="flex-1">
                    <div className="font-semibold">{picked.name}</div>
                    {picked.address && (
                      <div className="text-(--text-secondary)">{picked.address}</div>
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

            <div className="rounded-2xl border border-(--surface-border) bg-white p-4">
              <div className="text-[13px] font-semibold text-(--text-primary)">
                Or type the name
              </div>
              <div className="mt-1 text-[12px] text-(--text-secondary)">
                If search doesn&apos;t find it, name it yourself.
              </div>
              <input
                ref={nameInputRef}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (picked && e.target.value !== picked.name) setPicked(null);
                }}
                placeholder="Place name"
                className="mt-2 w-full rounded-xl border border-(--surface-border) bg-(--map-bg) px-3 py-3 text-[16px] text-(--text-primary) placeholder:text-(--text-tertiary) focus:outline-hidden focus:ring-2 focus:ring-accent"
              />
            </div>

            <div className="rounded-2xl border border-(--surface-border) bg-white p-4">
              <div className="text-[13px] font-semibold text-(--text-primary)">
                Or use an address
              </div>
              <div className="mt-1 text-[12px] text-(--text-secondary)">
                If GPS isn&apos;t working, type an address — we&apos;ll look up the
                coordinates.
              </div>
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-(--surface-border) bg-(--map-bg) px-3 py-3 focus-within:ring-2 focus-within:ring-accent">
                <Icon name="MapPinLine" size={16} className="text-(--text-tertiary)" />
                <input
                  value={addressQuery}
                  onChange={(e) => {
                    setAddressQuery(e.target.value);
                    if (picked && picked.types.length === 0) setPicked(null);
                  }}
                  placeholder="e.g. 12 rue de la Convention, Paris"
                  className="flex-1 bg-transparent text-[15px] text-(--text-primary) placeholder:text-(--text-tertiary) focus:outline-hidden"
                />
                {addressSearching && (
                  <Icon
                    name="CircleNotch"
                    size={16}
                    className="animate-spin text-(--text-tertiary)"
                  />
                )}
              </div>
              {addressPredictions.length > 0 && (
                <ul className="mt-2 overflow-hidden rounded-xl border border-(--surface-border) bg-white shadow-card">
                  {addressPredictions.map((p) => (
                    <li key={p.placeId}>
                      <button
                        type="button"
                        onClick={() => onPickAddress(p)}
                        className="block w-full px-3 py-2.5 text-left hover:bg-sys-gray-6"
                      >
                        <div className="text-[14px] font-medium text-(--text-primary)">
                          {p.primary || p.text}
                        </div>
                        {p.secondary && (
                          <div className="text-[11px] text-(--text-secondary)">
                            {p.secondary}
                          </div>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {picked && picked.types.length === 0 && (
                <div className="mt-2 flex items-start gap-2 rounded-xl bg-accent-tint p-3 text-[12px] text-(--text-primary)">
                  <Icon name="MapPin" size={14} className="mt-0.5 text-accent" />
                  <div className="flex-1">
                    <div className="font-semibold">Address locked in</div>
                    {picked.address && (
                      <div className="text-(--text-secondary)">{picked.address}</div>
                    )}
                    <div className="mt-0.5 text-[11px] text-(--text-tertiary)">
                      {picked.lat.toFixed(5)}, {picked.lng.toFixed(5)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Did-you-mean cards (#82). Surfaces existing rows within 150m
                with a similar name so users don't double-add a place that's
                already on the map but hidden by the cafés-only default. */}
            {nearbyMatches.length > 0 && reviewPromptForId === null && (
              <div className="rounded-2xl border border-(--surface-border) bg-white p-4">
                <div className="text-[13px] font-semibold text-(--text-primary)">
                  Did you mean…?
                </div>
                <div className="mt-1 text-[12px] text-(--text-secondary)">
                  We already have these nearby. Tap one to confirm it&rsquo;s the place — we&rsquo;ll show it on the map.
                </div>
                <ul className="mt-3 flex flex-col gap-2">
                  {nearbyMatches.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        disabled={validatingId !== null}
                        onClick={() => handleValidateMatch(m)}
                        className="flex w-full items-start gap-3 rounded-xl border border-(--surface-border) bg-(--map-bg) px-3 py-2.5 text-left transition hover:bg-sys-gray-6 disabled:opacity-60"
                      >
                        <Icon
                          name={CATEGORIES[m.category as PlaceCategory]?.icon ?? 'MapPin'}
                          size={16}
                          className="mt-0.5 text-accent"
                        />
                        <div className="flex-1">
                          <div className="text-[14px] font-medium text-(--text-primary)">
                            {m.name}
                          </div>
                          {(m.brand || m.category) && (
                            <div className="text-[11px] text-(--text-secondary)">
                              {m.brand ? `${m.brand} · ` : ''}
                              {CATEGORIES[m.category as PlaceCategory]?.label ?? m.category}
                            </div>
                          )}
                        </div>
                        {validatingId === m.id ? (
                          <Icon
                            name="CircleNotch"
                            size={14}
                            className="mt-1 animate-spin text-(--text-tertiary)"
                          />
                        ) : (
                          <Icon
                            name="CaretRight"
                            size={14}
                            className="mt-1 text-(--text-tertiary)"
                          />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Post-validate review nudge (#82). Confirms the validation and
                offers the natural follow-up: "want to leave a review?". */}
            {reviewPromptForId !== null && (
              <div className="rounded-2xl border border-accent bg-accent-tint p-4">
                <div className="flex items-start gap-2">
                  <Icon
                    name="CheckCircle"
                    size={20}
                    weight="fill"
                    className="mt-0.5 text-accent"
                  />
                  <div className="flex-1">
                    <div className="text-[14px] font-semibold text-(--text-primary)">
                      Added to the map
                    </div>
                    <div className="mt-1 text-[12px] text-(--text-secondary)">
                      Want to leave a review while you&rsquo;re here? Helps
                      others find it too.
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      clearDraft();
                      router.push(`/review/new/${encodeURIComponent(reviewPromptForId)}`);
                    }}
                    className="flex-1 rounded-xl bg-accent py-2.5 text-[13px] font-semibold text-white hover:opacity-90"
                  >
                    Yes, review now
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearDraft();
                      router.push('/');
                    }}
                    className="flex-1 rounded-xl border border-(--surface-border) bg-white py-2.5 text-[13px] font-semibold text-(--text-primary) hover:bg-sys-gray-6"
                  >
                    No thanks
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'describe' && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-(--surface-border) bg-white p-4">
              <div className="flex items-center gap-2 text-[12px] text-(--text-secondary)">
                <Icon name="Storefront" size={14} />
                <span className="font-medium uppercase tracking-wide">Adding</span>
              </div>
              <div className="mt-1 text-[16px] font-semibold text-(--text-primary)">
                {name.trim() || 'Untitled place'}
              </div>
              {picked?.address && (
                <div className="text-[12px] text-(--text-secondary)">
                  {picked.address}
                </div>
              )}
            </div>

            <div>
              <div className="text-[13px] font-semibold text-(--text-primary)">
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
                          : 'border-(--surface-border) bg-white text-(--text-primary) hover:bg-sys-gray-6'
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
                  className="mt-3 w-full rounded-xl border border-(--surface-border) bg-white px-3 py-3 text-[15px] text-(--text-primary) placeholder:text-(--text-tertiary) focus:outline-hidden focus:ring-2 focus:ring-accent"
                />
              )}
            </div>

            <label className="block">
              <div className="text-[13px] font-semibold text-(--text-primary)">
                Notes (optional)
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 280))}
                placeholder="Hours, Wi-Fi, anything a future worker should know."
                rows={4}
                className="mt-2 w-full resize-none rounded-xl border border-(--surface-border) bg-white px-3 py-3 text-[15px] text-(--text-primary) placeholder:text-(--text-tertiary) focus:outline-hidden focus:ring-2 focus:ring-accent"
              />
              <div className="mt-1 text-right text-[11px] text-(--text-tertiary)">
                {notes.length}/280
              </div>
            </label>

            <div className="rounded-2xl bg-sys-gray-6 px-4 py-3 text-[12px] text-(--text-secondary)">
              <div className="flex items-center gap-2">
                <Icon name="MapPinLine" size={14} />
                <span className="font-semibold text-(--text-primary)">Location</span>
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

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-(--surface-border) bg-white/95 p-4 backdrop-blur-ios">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button
            type="button"
            onClick={goBack}
            disabled={submitting}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-(--surface-border) bg-white text-(--text-primary) hover:bg-sys-gray-6 disabled:opacity-60"
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
