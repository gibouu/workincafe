'use client';

import type { AriaAttributes, ReactNode } from 'react';
import { Icon } from '@/components/icons/Icon';
import { useLayout } from '@/lib/store/layout';

export function TopRightControls({
  onFilter,
  onGeolocate,
  geolocating,
  filterCount = 0,
  showFilter = true,
}: {
  onFilter?: () => void;
  onGeolocate?: () => void;
  geolocating?: boolean;
  filterCount?: number;
  showFilter?: boolean;
}) {
  const cardOpen = useLayout((s) => s.cardOpen);
  // Card is at right-4 with width 360 — shift the controls just past it on
  // desktop when the panel is open so they don't get hidden behind it.
  const rightClass = cardOpen ? 'right-4 md:right-[392px]' : 'right-4';
  return (
    <div className={`pointer-events-none absolute top-4 ${rightClass} z-30 flex flex-col gap-2 transition-[right] duration-200`}>
      {showFilter && onFilter && (
        <div className="relative">
          <PillButton aria-label="Filter" onClick={onFilter}>
            <Icon name="SlidersHorizontal" size={20} />
          </PillButton>
          {filterCount > 0 && (
            <span className="pointer-events-none absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold text-white shadow">
              {filterCount}
            </span>
          )}
        </div>
      )}
      <PillButton aria-label="My location" onClick={onGeolocate}>
        <Icon
          name={geolocating ? 'CircleNotch' : 'NavigationArrow'}
          size={20}
          weight={geolocating ? 'regular' : 'fill'}
          className={geolocating ? 'animate-spin' : 'text-accent'}
        />
      </PillButton>
    </div>
  );
}

function PillButton({
  children,
  onClick,
  ...rest
}: {
  children: ReactNode;
  onClick?: () => void;
} & AriaAttributes) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-[var(--surface-border)] bg-[var(--surface)] backdrop-blur-ios shadow-float text-[var(--text-primary)] hover:bg-white transition"
      {...rest}
    >
      {children}
    </button>
  );
}
