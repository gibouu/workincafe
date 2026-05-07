'use client';

import Image from 'next/image';
import { CLOUDINARY_CLOUD_NAME } from '@/lib/cloudinary';
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

export function ReviewPhotos({ photos }: { photos: ReviewPhoto[] }) {
  if (photos.length === 0) return null;
  const ordered = [...photos].sort(
    (a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot),
  );

  return (
    <ul className="mt-3 flex gap-2 overflow-x-auto">
      {ordered.map((p) => {
        const url = rawCloudinaryUrl(p);
        if (!url) return null;
        return (
          <li
            key={`${p.slot}-${p.publicId}`}
            className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-sys-gray-6"
          >
            <Image
              src={url}
              alt={SLOT_LABEL[p.slot]}
              fill
              sizes="96px"
              className="object-cover"
              unoptimized={false}
            />
            <span className="absolute bottom-1 left-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white">
              {SLOT_LABEL[p.slot]}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
