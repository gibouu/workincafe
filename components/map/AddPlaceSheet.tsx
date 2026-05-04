'use client';

import { useEffect, useRef, useState } from 'react';
import { Drawer } from 'vaul';
import { Icon } from '@/components/icons/Icon';
import { CATEGORIES, type PlaceCategory } from '@/lib/categories';
import { useToasts } from '@/lib/store/toasts';

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

const GOOGLE_TYPE_TO_CATEGORY: Record<string, PlaceCategory> = {
  cafe: 'cafe',
  bakery: 'bakery',
  library: 'library',
  lodging: 'hotel',
  hotel: 'hotel',
  restaurant: 'restaurant',
  meal_takeaway: 'restaurant',
  meal_delivery: 'restaurant',
  coworking_space: 'coworking',
};

function inferCategory(types: string[], current: PlaceCategory): PlaceCategory {
  for (const t of types) {
    const c = GOOGLE_TYPE_TO_CATEGORY[t];
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

export function AddPlaceSheet({
  open,
  onOpenChange,
  center,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  center: { lat: number; lng: number } | null;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<PlaceCategory>('cafe');
  const [customType, setCustomType] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [lookupAvailable, setLookupAvailable] = useState(true);
  const [picked, setPicked] = useState<PlaceDetails | null>(null);
  const sessionTokenRef = useRef<string>(newSessionToken());
  const showToast = useToasts((s) => s.show);

  const reset = () => {
    setName('');
    setCategory('cafe');
    setCustomType('');
    setNotes('');
    setSearch('');
    setPredictions([]);
    setPicked(null);
    sessionTokenRef.current = newSessionToken();
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  // Debounced autocomplete query.
  useEffect(() => {
    if (!open) return;
    if (picked) return; // user has selected; don't keep firing
    const q = search.trim();
    if (q.length < 2) {
      setPredictions([]);
      return;
    }
    let aborted = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const resp = await fetch(
          `/api/places/lookup?q=${encodeURIComponent(q)}&token=${sessionTokenRef.current}`,
        );
        if (resp.status === 503) {
          if (!aborted) {
            setLookupAvailable(false);
            setPredictions([]);
          }
          return;
        }
        if (!resp.ok) {
          if (!aborted) setPredictions([]);
          return;
        }
        const body = (await resp.json()) as { predictions?: Prediction[] };
        if (!aborted) {
          setPredictions(body.predictions ?? []);
          setLookupAvailable(true);
        }
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
  }, [search, open, picked]);

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

  const useMapCenterInstead = () => {
    setPicked(null);
    setPredictions([]);
  };

  const submitLat = picked?.lat ?? center?.lat ?? null;
  const submitLng = picked?.lng ?? center?.lng ?? null;
  const submitAddress = picked?.address ?? null;
  const customTrim = customType.trim();
  const canSubmit =
    name.trim().length > 1 &&
    submitLat !== null &&
    submitLng !== null &&
    (category !== 'other' || customTrim.length > 1);

  const onSubmit = () => {
    if (!canSubmit || submitLat === null || submitLng === null) return;
    // When the user picked Other, prepend the custom type to notes so the
    // admin reviewer can re-categorize. The API's `category` enum stays
    // 'other' until an admin moves the place into one of our buckets.
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
      // ignore demo storage failures
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
    handleClose(false);
  };

  return (
    <Drawer.Root open={open} onOpenChange={handleClose} snapPoints={[0.7, 0.95]}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/20 z-40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md rounded-t-3xl bg-white shadow-float outline-none flex flex-col max-h-[95vh]">
          <Drawer.Title className="sr-only">Add a place</Drawer.Title>
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-sys-gray-4" />

          <div className="flex items-center justify-between px-5 pt-3">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
                Help us find more spots
              </div>
              <div className="text-[17px] font-semibold text-[var(--text-primary)]">
                Add a place
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleClose(false)}
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-sys-gray-6 text-[var(--text-secondary)]"
            >
              <Icon name="X" size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {lookupAvailable && (
              <div className="relative">
                <div className="text-[13px] font-semibold text-[var(--text-primary)]">
                  Search Google
                </div>
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--map-bg)] px-3 py-2.5 focus-within:ring-2 focus-within:ring-accent">
                  <Icon name="MagnifyingGlass" size={14} className="text-[var(--text-tertiary)]" />
                  <input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      if (picked) setPicked(null);
                    }}
                    placeholder="Type a place name…"
                    className="flex-1 bg-transparent text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
                  />
                  {searching && <Icon name="CircleNotch" size={14} className="animate-spin text-[var(--text-tertiary)]" />}
                </div>
                {predictions.length > 0 && !picked && (
                  <ul className="mt-2 overflow-hidden rounded-xl border border-[var(--surface-border)] bg-white shadow-card">
                    {predictions.map((p) => (
                      <li key={p.placeId}>
                        <button
                          type="button"
                          onClick={() => onPick(p)}
                          className="block w-full px-3 py-2 text-left hover:bg-sys-gray-6"
                        >
                          <div className="text-[14px] font-medium text-[var(--text-primary)]">
                            {p.primary || p.text}
                          </div>
                          {p.secondary && (
                            <div className="text-[11px] text-[var(--text-secondary)]">{p.secondary}</div>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {picked && (
                  <div className="mt-2 flex items-start gap-2 rounded-xl bg-accent-tint p-3 text-[12px] text-[var(--text-primary)]">
                    <Icon name="MapPin" size={14} className="mt-0.5 text-accent" />
                    <div className="flex-1">
                      <div className="font-semibold">{picked.name}</div>
                      <div className="text-[var(--text-secondary)]">{picked.address}</div>
                      <button
                        type="button"
                        onClick={useMapCenterInstead}
                        className="mt-1 text-[11px] font-medium text-accent hover:underline"
                      >
                        Use map center instead
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <label className="mt-4 block">
              <div className="text-[13px] font-semibold text-[var(--text-primary)]">Name</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Café de la Paix"
                className="mt-1 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--map-bg)] px-3 py-2.5 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </label>

            <div className="mt-4">
              <div className="text-[13px] font-semibold text-[var(--text-primary)]">
                Category
              </div>
              <div className="mt-1 flex flex-wrap gap-2">
                {CATEGORY_KEYS.map((c) => {
                  const meta = CATEGORIES[c];
                  const active = category === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition ${
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
                  placeholder="What kind of place? e.g. brewery, museum café…"
                  className="mt-2 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--map-bg)] px-3 py-2 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-accent"
                />
              )}
            </div>

            <label className="mt-4 block">
              <div className="text-[13px] font-semibold text-[var(--text-primary)]">
                Notes (optional)
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 280))}
                placeholder="Hours, Wi-Fi, anything a future worker should know."
                rows={3}
                className="mt-1 w-full resize-none rounded-xl border border-[var(--surface-border)] bg-[var(--map-bg)] px-3 py-2 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </label>

            <div className="mt-4 rounded-xl bg-sys-gray-6 px-4 py-3 text-[12px] text-[var(--text-secondary)]">
              <div className="flex items-center gap-2">
                <Icon name="MapPinLine" size={14} />
                <span className="font-semibold text-[var(--text-primary)]">Location</span>
              </div>
              <div className="mt-1">
                {picked
                  ? `${picked.lat.toFixed(5)}, ${picked.lng.toFixed(5)} · from Google`
                  : center
                    ? `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)} · captured from map center`
                    : 'Move the map over the place, then open this again.'}
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--surface-border)] p-4">
            <button
              type="button"
              disabled={!canSubmit}
              onClick={onSubmit}
              className="w-full rounded-2xl bg-accent py-3.5 text-[15px] font-semibold text-white hover:opacity-90 disabled:bg-sys-gray-4 disabled:cursor-not-allowed transition"
            >
              Submit for review
            </button>
            <p className="mt-2 text-center text-[11px] text-[var(--text-tertiary)]">
              We&apos;ll review and add it to the map.
            </p>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
