'use client';

import { create } from 'zustand';

export type RightPanelMode = 'place' | 'profile' | 'friends' | null;

interface LayoutState {
  /** True whenever the right-side panel is open (any mode). Used by
   *  BottomBar to slide out of the way on mobile. */
  cardOpen: boolean;
  setCardOpen: (open: boolean) => void;

  /** Which surface the right-side panel is showing on desktop. */
  panel: RightPanelMode;
  setPanel: (mode: RightPanelMode) => void;
}

export const useLayout = create<LayoutState>((set) => ({
  cardOpen: false,
  setCardOpen: (cardOpen) => set({ cardOpen }),
  panel: null,
  setPanel: (panel) => set({ panel, cardOpen: panel !== null }),
}));
