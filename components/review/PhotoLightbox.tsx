'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Icon } from '@/components/icons/Icon';

const SLOT_LABEL: Record<string, string> = {
  menu: 'Menu',
  inside: 'Inside',
  outside: 'Outside',
  special: 'Detail',
};

export interface LightboxPhoto {
  url: string;
  slot: string;
  width?: number | null;
  height?: number | null;
}

interface PhotoLightboxProps {
  photos: LightboxPhoto[];
  /** Index of the photo to show first; clamped to [0, photos.length-1]. */
  initialIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PhotoLightbox({ photos, initialIndex, open, onOpenChange }: PhotoLightboxProps) {
  const safeStart = Math.min(Math.max(initialIndex, 0), Math.max(photos.length - 1, 0));
  const [index, setIndex] = useState(safeStart);

  // Reset to the requested photo every time the lightbox opens. Deliberate
  // prop→state reset on an open transition — an effect is the right tool.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setIndex(safeStart);
  }, [open, safeStart]);

  // Esc to close, arrow keys to navigate.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
      else if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + photos.length) % photos.length);
      else if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % photos.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, photos.length, onOpenChange]);

  // Body scroll lock so the page underneath doesn't move while the lightbox
  // is open — avoids accidental dismiss of the parent drawer on mobile.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || photos.length === 0) return null;

  const current = photos[index];
  const showNav = photos.length > 1;
  const slotLabel = SLOT_LABEL[current.slot] ?? current.slot;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label={`${slotLabel} photo, ${index + 1} of ${photos.length}`}
      onClick={() => onOpenChange(false)}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(false);
        }}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-ios"
      >
        <Icon name="X" size={18} />
      </button>

      <div
        className="relative h-full w-full max-w-3xl px-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-full w-full">
          <Image
            src={current.url}
            alt={slotLabel}
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-contain"
            priority
          />
        </div>

        <div className="pointer-events-none absolute bottom-6 left-0 right-0 flex justify-center">
          <div className="rounded-full bg-black/55 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-white">
            {slotLabel}
            {showNav ? ` · ${index + 1} / ${photos.length}` : ''}
          </div>
        </div>
      </div>

      {showNav && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={(e) => {
              e.stopPropagation();
              setIndex((i) => (i - 1 + photos.length) % photos.length);
            }}
            className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-ios"
          >
            <Icon name="CaretLeft" size={18} />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={(e) => {
              e.stopPropagation();
              setIndex((i) => (i + 1) % photos.length);
            }}
            className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-ios"
          >
            <Icon name="CaretRight" size={18} />
          </button>
        </>
      )}
    </div>
  );
}
