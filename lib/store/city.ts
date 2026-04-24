'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CITIES, type City, type CityMeta } from '@/lib/demo/cities';

export { CITIES, type City, type CityMeta };

interface CityStore {
  city: City;
  setCity: (c: City) => void;
}

export const useCity = create<CityStore>()(
  persist(
    (set) => ({
      city: 'paris',
      setCity: (city) => set({ city }),
    }),
    { name: 'wic:city' },
  ),
);
