// Maps a raw `/api/places/[id]/reviews` row into the DemoReview shape the
// review UI renders. Shared by PlaceCardBody (user reviews) and
// AllReviewsSheet (the separate "Imported" section) so the two never drift.
import type { DemoReview, ReviewPhoto } from '@/lib/demo/reviews';
import { importedReviewLabel } from '@/lib/demo/reviews';

export interface DbReview {
  id: string;
  overall_rating: number | null;
  wifi_rating: number | null;
  noise_rating: number | null;
  seating_rating: number | null;
  comment: string | null;
  geo_verified: boolean;
  created_at: string;
  source?: string;
  users: { display_name: string | null } | null;
  review_photos:
    | {
        slot: string;
        cloudinary_public_id: string;
        cloudinary_version: string | null;
        width: number | null;
        height: number | null;
      }[]
    | null;
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function initialsFor(name: string | null | undefined): string {
  if (!name) return '··';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const ALLOWED_PHOTO_SLOTS = new Set(['menu', 'inside', 'outside', 'special', 'coffee']);

export function mapDbReviewToDemoShape(raw: unknown): DemoReview {
  const r = raw as DbReview;
  const isImported = !!r.source && r.source !== 'user';
  const author = isImported
    ? importedReviewLabel(r.source)
    : (r.users?.display_name ?? 'Anonymous');
  // Reviews now use the 1–10 scale; legacy 1–5 rows still read as 1–5 (lower
  // half of the new range). The DemoReview shape expects 1–5 — squish 1–10
  // back down for display until the demo type is widened.
  const squish = (v: number | null) => (v == null ? undefined : Math.max(1, Math.round(v / 2)));
  const photos = (r.review_photos ?? [])
    .filter((p) => ALLOWED_PHOTO_SLOTS.has(p.slot))
    .map((p) => ({
      slot: p.slot as ReviewPhoto['slot'],
      publicId: p.cloudinary_public_id,
      version: p.cloudinary_version,
      width: p.width,
      height: p.height,
    }));
  return {
    id: r.id,
    author,
    initials: isImported ? (r.source?.[0]?.toUpperCase() ?? '~') : initialsFor(author),
    trust: isImported ? 0 : 50,
    rating: squish(r.overall_rating) ?? 3,
    wifi: squish(r.wifi_rating),
    noise: squish(r.noise_rating),
    seating: squish(r.seating_rating),
    comment: r.comment ?? '',
    createdAgo: relativeTime(r.created_at),
    // Imported rows were never geo-checked — never show "Verified on site".
    geoVerified: isImported ? false : r.geo_verified,
    photos: photos.length > 0 ? photos : undefined,
    source: r.source,
  };
}
