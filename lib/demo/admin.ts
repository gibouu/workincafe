import type { PlaceCategory } from '@/lib/categories';

export interface DemoPlaceRequest {
  id: string;
  name: string;
  category: PlaceCategory;
  lat: number;
  lng: number;
  address: string;
  notes?: string;
  submitterName: string;
  distanceToNearestMeters: number;
  submittedAgo: string;
}

export const DEMO_PLACE_REQUESTS: DemoPlaceRequest[] = [
  {
    id: 'req-001',
    name: 'Maison Aleph',
    category: 'bakery',
    lat: 48.8601,
    lng: 2.3561,
    address: '20 Rue de la Verrerie',
    notes: 'Syrian-inspired pastries, outlets near the window, quiet mornings.',
    submitterName: 'Alice M.',
    distanceToNearestMeters: 180,
    submittedAgo: '2h ago',
  },
  {
    id: 'req-002',
    name: 'La REcyclerie',
    category: 'coworking',
    lat: 48.8982,
    lng: 2.3533,
    address: '83 Boulevard Ornano',
    notes: 'Co-working inside a converted train station, fast wifi.',
    submitterName: 'Ben K.',
    distanceToNearestMeters: 640,
    submittedAgo: '5h ago',
  },
  {
    id: 'req-003',
    name: 'Parisian Third Place',
    category: 'cafe',
    lat: 48.861,
    lng: 2.349,
    address: 'Unknown',
    submitterName: 'Camille T.',
    distanceToNearestMeters: 45,
    submittedAgo: '1d ago',
  },
];

export interface DemoFlaggedReview {
  id: string;
  placeName: string;
  reason: 'spam' | 'offensive' | 'untrue' | 'irrelevant' | 'other';
  notes?: string;
  reporter: string;
  authorTrust: number;
  geoVerified: boolean;
  reviewText: string;
  flaggedAgo: string;
}

export const DEMO_FLAGGED_REVIEWS: DemoFlaggedReview[] = [
  {
    id: 'fr-001',
    placeName: 'Ten Belles',
    reason: 'spam',
    notes: 'Looks like an ad for a competing shop.',
    reporter: 'Danielle R.',
    authorTrust: 4,
    geoVerified: false,
    reviewText:
      'Great place! For even better coffee, visit OtherBrand at 12 rue X — 10% off with code SUNNY.',
    flaggedAgo: '3h ago',
  },
  {
    id: 'fr-002',
    placeName: 'Holybelly 5',
    reason: 'untrue',
    notes: 'Noise rating says 1-star quiet, but the place is famously loud.',
    reporter: 'Éric V.',
    authorTrust: 62,
    geoVerified: true,
    reviewText: 'Super calme, rien ne te dérange ici.',
    flaggedAgo: '1d ago',
  },
];
