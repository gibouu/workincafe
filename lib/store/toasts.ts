'use client';

import { create } from 'zustand';

export type ToastTone = 'success' | 'info' | 'error';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  timeout: number;
}

interface ToastStore {
  toasts: Toast[];
  show: (message: string, opts?: { tone?: ToastTone; timeout?: number }) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToasts = create<ToastStore>((set, get) => ({
  toasts: [],
  show: (message, opts) => {
    const id = nextId++;
    const toast: Toast = {
      id,
      message,
      tone: opts?.tone ?? 'success',
      timeout: opts?.timeout ?? 3000,
    };
    set({ toasts: [...get().toasts, toast] });
    if (toast.timeout > 0) {
      setTimeout(() => get().dismiss(id), toast.timeout);
    }
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
