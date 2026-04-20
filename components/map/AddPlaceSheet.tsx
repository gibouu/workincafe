'use client';

import { useState } from 'react';
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
];

interface SubmittedRequest {
  name: string;
  category: PlaceCategory;
  notes: string;
  lat: number;
  lng: number;
  at: number;
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
  const [notes, setNotes] = useState('');
  const showToast = useToasts((s) => s.show);

  const reset = () => {
    setName('');
    setCategory('cafe');
    setNotes('');
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const canSubmit = name.trim().length > 1 && center !== null;

  const onSubmit = () => {
    if (!canSubmit || !center) return;
    const record: SubmittedRequest = {
      name: name.trim(),
      category,
      notes: notes.trim(),
      lat: center.lat,
      lng: center.lng,
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
    // Fire-and-forget API call; auth / not-migrated failures fall back to localStorage.
    void fetch('/api/places/request', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: record.name,
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

          <>
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
                <label className="block">
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
                          <Icon
                            name={meta.icon}
                            size={14}
                            weight={active ? 'fill' : 'regular'}
                          />
                          <span>{meta.label}</span>
                        </button>
                      );
                    })}
                  </div>
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
                    {center
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
                  Saved to your browser for demo. DB wiring lands after Phase 1 migration.
                </p>
              </div>
            </>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

