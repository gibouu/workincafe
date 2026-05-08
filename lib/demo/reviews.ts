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
}
