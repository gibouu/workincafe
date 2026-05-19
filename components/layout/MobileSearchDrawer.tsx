'use client';

import { Drawer } from 'vaul';
import { Icon } from '@/components/icons/Icon';
import { type DemoPlace } from '@/lib/demo/paris-places';
import { SearchPanel, type SidebarAnchor } from '@/components/layout/SearchPanel';

/**
 * Mobile-only search drawer (#141). Same SearchPanel content the
 * desktop sidebar uses, wrapped in a vaul bottom drawer. Triggered
 * by a top-left search button on the map page.
 *
 * On selection (place or anchor), the parent closes the drawer so
 * the user lands back on the map at the picked location.
 */
export function MobileSearchDrawer({
  open,
  onOpenChange,
  places,
  selectedId,
  onSelect,
  onOpenFilter,
  filterCount,
  anchor,
  onSetAnchor,
  onClearAnchor,
  viewport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  places: DemoPlace[];
  selectedId: string | null;
  onSelect: (place: DemoPlace) => void;
  onOpenFilter?: () => void;
  filterCount?: number;
  anchor?: SidebarAnchor | null;
  onSetAnchor?: (anchor: SidebarAnchor) => void;
  onClearAnchor?: () => void;
  viewport?: {
    bbox: [number, number, number, number];
    center: { lat: number; lng: number };
  } | null;
}) {
  // Close the drawer once the user picks something so they land back
  // on the map at the new location.
  const handleSelect = (place: DemoPlace) => {
    onSelect(place);
    onOpenChange(false);
  };
  const handleSetAnchor = (a: SidebarAnchor) => {
    onSetAnchor?.(a);
    onOpenChange(false);
  };

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/20 z-40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex h-[88dvh] max-w-md flex-col rounded-t-3xl bg-white shadow-float outline-hidden">
          <Drawer.Title className="sr-only">Search</Drawer.Title>
          <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-sys-gray-4" />
          <div className="mt-3 flex min-h-0 flex-1 flex-col">
            <SearchPanel
              places={places}
              selectedId={selectedId}
              onSelect={handleSelect}
              onOpenFilter={onOpenFilter}
              filterCount={filterCount}
              anchor={anchor}
              onSetAnchor={handleSetAnchor}
              onClearAnchor={onClearAnchor}
              viewport={viewport}
              autoFocus
            />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/**
 * Floating bottom-left button that opens the mobile search drawer.
 * Sits above the filter button in the bottom-left thumb-reach cluster
 * so the user can search without stretching to the top of the screen.
 * Location (geolocate) lives at the top-left now — see TopRightControls
 * `splitLayout` for the mobile geometry. Stacked positions:
 *   - bottom-[96px]: + add place
 *   - bottom-[150px]: filter
 *   - bottom-[210px]: search (this button)
 */
export function MobileSearchButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Search"
      className="pointer-events-auto absolute bottom-[210px] left-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-(--surface-border) bg-(--surface) text-(--text-primary) shadow-float backdrop-blur-ios hover:bg-white"
    >
      <Icon name="MagnifyingGlass" size={16} weight="bold" />
    </button>
  );
}
