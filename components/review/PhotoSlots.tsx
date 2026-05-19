'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import {
  PHOTO_SLOTS,
  PHOTO_SLOT_META,
  preparePhoto,
  type PhotoSlot,
  type PreparedPhoto,
} from '@/lib/review/photos';

export type SlotState = Partial<Record<PhotoSlot, PreparedPhoto>>;

interface PhotoSlotsProps {
  value: SlotState;
  onChange: (next: SlotState) => void;
  disabled?: boolean;
}

export function PhotoSlots({ value, onChange, disabled }: PhotoSlotsProps) {
  // Reorder: filled slots cluster left/top so the user always sees their
  // committed photos first, with empty slots trailing. Within each group
  // the canonical PHOTO_SLOTS order is preserved. See #41.
  const orderedSlots = [
    ...PHOTO_SLOTS.filter((s) => Boolean(value[s])),
    ...PHOTO_SLOTS.filter((s) => !value[s]),
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {orderedSlots.map((slot) => (
        <PhotoSlotCard
          key={slot}
          slot={slot}
          photo={value[slot]}
          onPick={(photo) => onChange({ ...value, [slot]: photo })}
          onClear={() => {
            const next = { ...value };
            delete next[slot];
            onChange(next);
          }}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

function PhotoSlotCard({
  slot,
  photo,
  onPick,
  onClear,
  disabled,
}: {
  slot: PhotoSlot;
  photo: PreparedPhoto | undefined;
  onPick: (photo: PreparedPhoto) => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  const meta = PHOTO_SLOT_META[slot];
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Object-URL lifecycle effect (create on photo, revoke on cleanup).
  useEffect(() => {
    if (!photo) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(photo.blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-pick same file
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const prepared = await preparePhoto(file);
      onPick(prepared);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read photo');
    } finally {
      setBusy(false);
    }
  };

  const filled = Boolean(photo);

  return (
    <div className="relative overflow-hidden rounded-xl border border-(--surface-border) bg-(--map-bg)">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || busy}
        className="flex w-full flex-col items-stretch text-left disabled:opacity-60"
      >
        {filled && previewUrl ? (
          <div className="relative aspect-4/3 w-full bg-black/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={meta.label}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex aspect-4/3 w-full flex-col items-center justify-center px-3 text-center">
            <Icon
              name={busy ? 'CircleNotch' : 'Camera'}
              size={22}
              className={busy ? 'animate-spin text-(--text-secondary)' : 'text-(--text-secondary)'}
            />
            <div className="mt-1 text-[12px] font-semibold text-(--text-primary)">
              {meta.label}
            </div>
            <div className="mt-0.5 text-[10px] leading-snug text-(--text-tertiary)">
              {meta.example}
            </div>
          </div>
        )}
      </button>
      {filled && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Remove ${meta.label} photo`}
          className="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white shadow-bubble"
        >
          <Icon name="X" size={14} />
        </button>
      )}
      {filled && (
        // Visual cue that tap-to-replace works. The whole card is already
        // clickable; this just signals the gesture. See #41.
        <span
          className="pointer-events-none absolute bottom-9 right-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white shadow-bubble"
          aria-hidden="true"
          title={`Tap to replace ${meta.label} photo`}
        >
          <Icon name="PencilSimple" size={13} />
        </span>
      )}
      {filled && (
        <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-(--text-tertiary)">
          {meta.label}
        </div>
      )}
      {error && (
        <div className="px-2 pb-2 text-[10px] text-accent-red">{error}</div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        capture="environment"
        onChange={onFileChange}
        className="hidden"
      />
    </div>
  );
}
