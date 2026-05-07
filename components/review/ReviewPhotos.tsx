'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { CLOUDINARY_CLOUD_NAME } from '@/lib/cloudinary';
import { PhotoLightbox, type LightboxPhoto } from '@/components/review/PhotoLightbox';
import type { ReviewPhoto } from '@/lib/demo/reviews';

const SLOT_LABEL: Record<ReviewPhoto['slot'], string> = {
  menu: 'Menu',
  inside: 'Inside',
  outside: 'Outside',
  special: 'Detail',
};

// Stable order so the strip layout doesn't jitter as different reviews come
// back with different slot subsets.
const SLOT_ORDER: ReviewPhoto['slot'][] = ['inside', 'menu', 'outside', 'special'];

function rawCloudinaryUrl(p: ReviewPhoto): string {
  if (!CLOUDINARY_CLOUD_NAME) return '';
  const version = p.version ? `${p.version}/` : '';
  // No transform path — next/image owns sizing/format via remotePatterns +
  // its own optimizer. Cloudinary serves the original; Vercel proxies and
  // returns AVIF/WebP per browser.
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${version}${p.publicId}`;
}

interface ReviewPhotosProps {
  photos: ReviewPhoto[];
  /** When provided, overrides the default in-place lightbox. Inline place-
   *  card usage passes this to redirect taps into the All Reviews sheet
   *  pre-filtered to "With photos". See #45. */
  onPhotoTap?: (index: number) => void;
}

export function ReviewPhotos({ photos, onPhotoTap }: ReviewPhotosProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const ordered = useMemo(
    () => [...photos].sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot)),
    [photos],
  );

  const lightboxPhotos = useMemo<LightboxPhoto[]>(
    () =>
      ordered
        .map((p) => ({ url: rawCloudinaryUrl(p), slot: p.slot, width: p.width, height: p.height }))
        .filter((p) => Boolean(p.url)),
    [ordered],
  );

  if (photos.length === 0) return null;

  return (
    <>
      <ul className="mt-3 flex gap-2 overflow-x-auto">
        {ordered.map((p, i) => {
          const url = rawCloudinaryUrl(p);
          if (!url) return null;
          return (
            <li key={`${p.slot}-${p.publicId}`}>
              <button
                type="button"
                onClick={() => (onPhotoTap ? onPhotoTap(i) : setLightboxIndex(i))}
                aria-label={`Open ${SLOT_LABEL[p.slot]} photo`}
                className="relative block h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-sys-gray-6"
              >
                <Image
                  src={url}
                  alt={SLOT_LABEL[p.slot]}
                  fill
                  sizes="96px"
                  className="object-cover transition group-hover:opacity-90"
                />
                <span className="absolute bottom-1 left-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white">
                  {SLOT_LABEL[p.slot]}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <PhotoLightbox
        photos={lightboxPhotos}
        initialIndex={lightboxIndex ?? 0}
        open={lightboxIndex !== null}
        onOpenChange={(o) => {
          if (!o) setLightboxIndex(null);
        }}
      />
    </>
  );
}
