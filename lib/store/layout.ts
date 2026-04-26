'use client';

import { create } from 'zustand';

interface LayoutState {
  cardOpen: boolean;
  setCardOpen: (open: boolean) => void;
}

export const useLayout = create<LayoutState>((set) => ({
  cardOpen: false,
  setCardOpen: (cardOpen) => set({ cardOpen }),
}));
