/**
 * Cloudinary helpers — URL builder for displaying images and a small wrapper
 * around the Node `crypto` module used by `/api/cloudinary/sign` to sign
 * direct browser uploads.
 *
 * Review photos live on Cloudinary; claim proofs (private, sometimes PDF)
 * stay on Supabase Storage.
 */

const CLOUD_NAME =
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? process.env.CLOUDINARY_CLOUD_NAME ?? '';

export const CLOUDINARY_CLOUD_NAME = CLOUD_NAME;

export interface CloudinaryUrlOptions {
  /** Width in pixels — Cloudinary scales the longest edge respecting aspect. */
  w?: number;
  /** Height in pixels — pair with `w` and `c` for crops. */
  h?: number;
  /** Crop mode (e.g. `fill`, `fit`). Default unset. */
  c?: string;
  /** Override format (default `auto` picks AVIF/WebP/JPEG per browser). */
  f?: string;
  /** Override quality (default `auto`). */
  q?: string;
  /** Override version, e.g. `v1700000000`. Improves cache hits. */
  version?: string;
}

/**
 * Build a Cloudinary delivery URL.
 *   cloudinaryUrl('reviews/abc123', { w: 800 })
 *   → https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto,w_800/reviews/abc123
 */
export function cloudinaryUrl(publicId: string, opts: CloudinaryUrlOptions = {}): string {
  if (!CLOUD_NAME) return '';
  const t: string[] = [];
  t.push(`f_${opts.f ?? 'auto'}`);
  t.push(`q_${opts.q ?? 'auto'}`);
  if (opts.w) t.push(`w_${opts.w}`);
  if (opts.h) t.push(`h_${opts.h}`);
  if (opts.c) t.push(`c_${opts.c}`);
  const transform = t.join(',');
  const version = opts.version ? `${opts.version}/` : '';
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transform}/${version}${publicId}`;
}

/**
 * SHA-1 sign the parameters Cloudinary expects for a signed upload. Server-
 * only — never call from the browser. The body is a sorted `key=value&…`
 * string with the API secret appended (per Cloudinary docs).
 */
export async function signCloudinaryUpload(
  params: Record<string, string | number>,
  apiSecret: string,
): Promise<string> {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  const data = new TextEncoder().encode(sorted + apiSecret);
  const hash = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
