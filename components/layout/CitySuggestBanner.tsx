'use client';

import { Icon } from '@/components/icons/Icon';
import { CITIES, type City } from '@/lib/store/city';

interface CitySuggestBannerProps {
  city: City;
  onAccept: () => void;
  onDismiss: () => void;
}

// Floating prompt anchored top-center on the map. Replaces the silent
// auto-switch from PR #47 (issue #18) — see #48. Hidden when the user has
// already accepted, dismissed, or set a city manually before.
export function CitySuggestBanner({ city, onAccept, onDismiss }: CitySuggestBannerProps) {
  const label = CITIES[city]?.label ?? city;
  return (
    <div className="pointer-events-none fixed left-1/2 top-3 z-[55] -translate-x-1/2 px-3">
      <div className="pointer-events-auto flex max-w-[92vw] items-center gap-2 rounded-full border border-[var(--surface-border)] bg-white/95 py-1.5 pl-3 pr-1 shadow-float backdrop-blur-ios">
        <Icon name="MapPin" size={14} className="text-accent" />
        <span className="whitespace-nowrap text-[12px] text-[var(--text-primary)]">
          We think you&rsquo;re in <strong className="font-semibold">{label}</strong> — switch?
        </span>
        <button
          type="button"
          onClick={onAccept}
          className="rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-white hover:opacity-90 transition"
        >
          Switch
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Keep current city"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-sys-gray-6"
        >
          <Icon name="X" size={12} />
        </button>
      </div>
    </div>
  );
}
