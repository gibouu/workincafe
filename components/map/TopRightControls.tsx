'use client';

import type { AriaAttributes, ReactNode } from 'react';
import { Icon } from '@/components/icons/Icon';

/**
 * Map control buttons. On mobile the buttons split across the screen
 * for thumb-reach: location/geolocate sits at the top so it's discoverable,
 * filter sits at the bottom alongside the add-place + search cluster.
 * On desktop the legacy stacked layout (bottom-left) keeps both buttons
 * near the floating place card. See #134 + thumb-reach feedback.
 */
export function TopRightControls({
  onFilter,
  onGeolocate,
  geolocating,
  geolocateBlocked = false,
  filterCount = 0,
  showFilter = true,
  splitLayout = false,
}: {
  onFilter?: () => void;
  onGeolocate?: () => void;
  geolocating?: boolean;
  /** True when the Permissions API reports `denied`. Renders a red dot on
   *  the geolocate button so the user knows tapping it won't prompt. */
  geolocateBlocked?: boolean;
  filterCount?: number;
  showFilter?: boolean;
  /** Mobile: render geolocate at top-left, filter at bottom-left
   *  (separately). Default false → legacy stacked bottom-left for desktop. */
  splitLayout?: boolean;
}) {
  const geolocateButton = onGeolocate ? (
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
  ) : null;

  const filterButton =
    showFilter && onFilter ? (
      <div className="relative">
        <PillButton aria-label="Filter" onClick={onFilter}>
          <Icon name="SlidersHorizontal" size={20} />
        </PillButton>
        {filterCount > 0 && (
          <span className="pointer-events-none absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold text-white shadow-sm">
            {filterCount}
          </span>
        )}
      </div>
    ) : null;

  if (splitLayout) {
    return (
      <>
        {/* Top-left: geolocate. Easy to spot on landing — most users
            want to find places "near me" before anything else. */}
        {geolocateButton && (
          <div className="pointer-events-none absolute top-4 left-4 z-30">
            {geolocateButton}
          </div>
        )}
        {/* Bottom-left: filter. Pairs with the add-place "+" and search
            buttons in the bottom-left thumb-reach cluster. */}
        {filterButton && (
          <div className="pointer-events-none absolute bottom-[150px] left-4 z-30">
            {filterButton}
          </div>
        )}
      </>
    );
  }

  // Default (desktop): stacked bottom-left, filter above geolocate.
  return (
    <div className="pointer-events-none absolute bottom-[150px] left-4 z-30 flex flex-col gap-2">
      {filterButton}
      {geolocateButton}
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
      className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-(--surface-border) bg-(--surface) backdrop-blur-ios shadow-float text-(--text-primary) hover:bg-white transition"
      {...rest}
    >
      {children}
    </button>
  );
}
