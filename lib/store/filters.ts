'use client';

import { create } from 'zustand';
import type { PlaceCategory } from '@/lib/categories';

export type NoiseFilter = 'quiet' | 'moderate' | 'loud' | 'any';
export type WifiFilter = 'slow' | 'moderate' | 'fast' | 'any';
export type SeatsFilter = 'plenty' | 'some' | 'any';
export type RatingFilter = 3.5 | 4.0 | 4.5 | null;

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
  reset: () => void;
  activeCount: () => number;
}

// Empty set means "no category filter" — all categories visible.
// Selecting one or more chips narrows the map to those.
export const useFilters = create<FilterState>((set, get) => ({
  categories: new Set<PlaceCategory>(),
  openNow: false,
  outlets: false,
  outdoor: false,
  quietNow: false,
  noise: 'any',
  wifi: 'any',
  seats: 'any',
  minRating: null,
  maxDistanceKm: 2,
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
  reset: () =>
    set({
      categories: new Set<PlaceCategory>(),
      openNow: false,
      outlets: false,
      outdoor: false,
      quietNow: false,
      noise: 'any',
      wifi: 'any',
      seats: 'any',
      minRating: null,
      maxDistanceKm: 2,
    }),
  activeCount: () => {
    const s = get();
    let n = 0;
    if (s.categories.size > 0) n++;
    if (s.openNow) n++;
    if (s.outlets) n++;
    if (s.outdoor) n++;
    if (s.quietNow) n++;
    if (s.noise !== 'any') n++;
    if (s.wifi !== 'any') n++;
    if (s.seats !== 'any') n++;
    if (s.minRating !== null) n++;
    if (s.maxDistanceKm !== 2) n++;
    return n;
  },
}));
