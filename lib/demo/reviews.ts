// Reviews now come from the database via /api/places/[id]/reviews. The
// pre-launch placeholder pool has been removed — the UI shows a "no reviews
// yet" state until a real review is posted.
export type ReviewPhotoSlot = 'menu' | 'inside' | 'outside' | 'special' | 'coffee';

export interface ReviewPhoto {
  slot: ReviewPhotoSlot;
  publicId: string;
  version?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface DemoReview {
  id: string;
  author: string;
  initials: string;
  trust: number;
  rating: number;
  wifi?: number;
  noise?: number;
  seating?: number;
  comment: string;
  createdAgo: string;
  geoVerified: boolean;
  photos?: ReviewPhoto[];
  /** Provenance. Absent / 'user' = a genuine visitor review. Anything else
   *  ('yelp' | 'foursquare' | 'google' | 'system') is an imported/seeded row
   *  surfaced under the separate "Imported" section. */
  source?: string;
}

/** Human label for an imported review's provider. */
export function importedReviewLabel(source: string | undefined): string {
  switch (source) {
    case 'yelp':
      return 'From Yelp';
    case 'foursquare':
      return 'From Foursquare';
    case 'google':
      return 'From Google';
    case 'system':
      return 'Preliminary estimate';
    default:
      return 'Imported';
  }
}
