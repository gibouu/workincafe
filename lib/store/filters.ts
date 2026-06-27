'use client';

import { create } from 'zustand';
import type { PlaceCategory } from '@/lib/categories';

export type NoiseFilter = 'quiet' | 'moderate' | 'loud' | 'any';
export type WifiFilter = 'slow' | 'moderate' | 'fast' | 'any';
export type SeatsFilter = 'plenty' | 'some' | 'any';
export type RatingFilter = 3.5 | 4.0 | 4.5 | null;
/** Membership filter: 'any' = include all, 'free-only' = exclude
 *  paywall'd places, 'members-only' = only those with a membership
 *  note. Default 'any'. See #127. */
export type MembershipFilter = 'any' | 'free-only' | 'members-only';

export interface FilterState {
  categories: Set<PlaceCategory>;
  openNow: boolean;
  outlets: boolean;
  outdoor: boolean;
  quietNow: boolean;
  noise: NoiseFilter;
  wifi: WifiFilter;
  seats: SeatsFilter;
  minRating: RatingFilter;
  maxDistanceKm: number;
  membership: MembershipFilter;
  setCategories: (c: Set<PlaceCategory>) => void;
  toggleCategory: (c: PlaceCategory) => void;
  setOpenNow: (v: boolean) => void;
  setOutlets: (v: boolean) => void;
  setOutdoor: (v: boolean) => void;
  setQuietNow: (v: boolean) => void;
  setNoise: (v: NoiseFilter) => void;
  setWifi: (v: WifiFilter) => void;
  setSeats: (v: SeatsFilter) => void;
  setMinRating: (v: RatingFilter) => void;
  setMaxDistanceKm: (v: number) => void;
  setMembership: (v: MembershipFilter) => void;
  reset: () => void;
  activeCount: () => number;
}

// Default narrows the map to the work-core categories on first open —
// cafés, libraries, coworking (#194). The store is not persisted, so
// every reload re-applies this baseline. Selecting other chips widens
// the view (bakery/restaurant/hotel stay opt-in); reviewed-but-non-core
// places bypass the category check via `has_user_reviews` (see #77).
const DEFAULT_CATEGORIES: PlaceCategory[] = ['cafe', 'library', 'coworking'];

function isDefaultCategorySet(s: Set<PlaceCategory>): boolean {
  if (s.size !== DEFAULT_CATEGORIES.length) return false;
  for (const c of DEFAULT_CATEGORIES) if (!s.has(c)) return false;
  return true;
}

export const useFilters = create<FilterState>((set, get) => ({
  categories: new Set<PlaceCategory>(DEFAULT_CATEGORIES),
  openNow: false,
  outlets: false,
  outdoor: false,
  quietNow: false,
  noise: 'any',
  wifi: 'any',
  seats: 'any',
  minRating: null,
  maxDistanceKm: 2,
  membership: 'any',
  setCategories: (categories) => set({ categories }),
  toggleCategory: (c) => {
    const next = new Set(get().categories);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    set({ categories: next });
  },
  setOpenNow: (openNow) => set({ openNow }),
  setOutlets: (outlets) => set({ outlets }),
  setOutdoor: (outdoor) => set({ outdoor }),
  setQuietNow: (quietNow) => set({ quietNow }),
  setNoise: (noise) => set({ noise }),
  setWifi: (wifi) => set({ wifi }),
  setSeats: (seats) => set({ seats }),
  setMinRating: (minRating) => set({ minRating }),
  setMaxDistanceKm: (maxDistanceKm) => set({ maxDistanceKm }),
  setMembership: (membership) => set({ membership }),
  reset: () =>
    set({
      categories: new Set<PlaceCategory>(DEFAULT_CATEGORIES),
      openNow: false,
      outlets: false,
      outdoor: false,
      quietNow: false,
      noise: 'any',
      wifi: 'any',
      seats: 'any',
      minRating: null,
      maxDistanceKm: 2,
      membership: 'any',
    }),
  activeCount: () => {
    const s = get();
    let n = 0;
    // The work-core default (cafe/library/coworking) isn't an "active"
    // filter — it's the baseline the rest of the app is built around.
    // Anything different from that (zero categories, fewer chips, or
    // extras like bakery/restaurant/hotel) does count as active.
    if (!isDefaultCategorySet(s.categories)) n++;
    if (s.outlets) n++;
    if (s.noise !== 'any') n++;
    if (s.wifi !== 'any') n++;
    if (s.seats !== 'any') n++;
    if (s.minRating !== null) n++;
    if (s.membership !== 'any') n++;
    return n;
  },
}));
