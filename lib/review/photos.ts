export type PhotoSlot = 'menu' | 'inside' | 'outside' | 'special' | 'coffee';

export const PHOTO_SLOTS: PhotoSlot[] = ['menu', 'inside', 'outside', 'special', 'coffee'];

export interface PhotoSlotMeta {
  slot: PhotoSlot;
  label: string;
  example: string;
}

export const PHOTO_SLOT_META: Record<PhotoSlot, PhotoSlotMeta> = {
  menu: {
    slot: 'menu',
    label: 'Menu',
    example: 'The chalkboard, drink list, or pricing.',
  },
  inside: {
    slot: 'inside',
    label: 'Inside',
    example: 'The seating area, lighting, the vibe.',
  },
  outside: {
    slot: 'outside',
    label: 'Outside',
    example: 'The storefront so others can find it.',
  },
  special: {
    slot: 'special',
    label: 'Something special',
    example: 'The chair you’re sitting on, the cat, the view — anything.',
  },
  coffee: {
    slot: 'coffee',
    label: 'Your coffee',
    example: 'The latte art, the cup, the cortado — your drink.',
  },
};

const MAX_DIMENSION = 1600;
const QUALITY = 0.85;

// Hard cap on the original file the user picks. Most phone photos are 3–5 MB
// JPEG / 4–8 MB HEIC, so 10 MB lets every modern phone in. The canvas
// re-encode shrinks the result well below the OUTPUT cap.
const MAX_INPUT_BYTES = 10 * 1024 * 1024;
// Hard cap on what we actually upload after resize/recompress. With four
// slots that's 12 MB max per review.
const MAX_OUTPUT_BYTES = 3 * 1024 * 1024;
const ACCEPTED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export interface PreparedPhoto {
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load image'));
    };
    img.src = url;
  });
}

/**
 * Resize to MAX_DIMENSION longest edge and re-encode as JPEG. The canvas
 * round-trip strips EXIF metadata as a side effect — basic privacy hygiene.
 */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (!ACCEPTED_MIME.has(file.type)) {
    throw new Error('Only JPEG, PNG, WebP, and HEIC images are accepted.');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('That image is over 10 MB. Try a smaller one.');
  }
  const img = await loadImage(file);
  const longestEdge = Math.max(img.naturalWidth, img.naturalHeight);
  const scale = longestEdge > MAX_DIMENSION ? MAX_DIMENSION / longestEdge : 1;
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D not supported');
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', QUALITY),
  );
  if (!blob) throw new Error('Encoding failed');
  if (blob.size > MAX_OUTPUT_BYTES) {
    throw new Error('Photo is too detailed to fit under 3 MB even after resizing.');
  }

  return { blob, width, height, bytes: blob.size };
}
