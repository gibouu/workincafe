'use client';

import type { AriaAttributes, ReactNode } from 'react';
import { Icon } from '@/components/icons/Icon';

export function TopRightControls({
  onFilter,
  onGeolocate,
  geolocating,
  geolocateBlocked = false,
  filterCount = 0,
  showFilter = true,
}: {
  onFilter?: () => void;
  onGeolocate?: () => void;
  geolocating?: boolean;
  /** True when the Permissions API reports `denied`. Renders a red dot on
   *  the geolocate button so the user knows tapping it won't prompt. */
  geolocateBlocked?: boolean;
  filterCount?: number;
  showFilter?: boolean;
}) {
  // Sits on the LEFT just above the bottom-left "+" button so the right side
  // stays free for the floating place card.
  return (
    <div className="pointer-events-none absolute bottom-[150px] left-4 z-30 flex flex-col gap-2">
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
      <div className="relative">
        <PillButton aria-label="My location" onClick={onGeolocate}>
          <Icon
            name={geolocating ? 'CircleNotch' : 'NavigationArrow'}
            size={20}
            weight={geolocating ? 'regular' : 'fill'}
            className={geolocating ? 'animate-spin' : 'text-accent'}
          />
        </PillButton>
        {geolocateBlocked && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-white bg-accent-red"
          />
        )}
      </div>
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
