'use client';

import { Icon } from '@/components/icons/Icon';
import { type DemoPlace } from '@/lib/demo/paris-places';
import { SearchPanel, type SidebarAnchor } from '@/components/layout/SearchPanel';

export type { SidebarAnchor };

export function PlaceSidebar({
  places,
  selectedId,
  onSelect,
  onOpenFilter,
  filterCount = 0,
  anchor,
  onSetAnchor,
  onClearAnchor,
  viewport,
}: {
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
  return (
    <aside className="hidden md:flex h-full w-[320px] shrink-0 flex-col border-r border-(--surface-border) bg-white/70 backdrop-blur-ios">
      <div className="flex items-center gap-2 px-5 pt-5 pb-2">
        <Icon name="Coffee" weight="fill" size={22} className="text-(--text-primary)" />
        <div className="text-[17px] font-semibold text-(--text-primary)">Work in Cafe</div>
      </div>
      <SearchPanel
        places={places}
        selectedId={selectedId}
        onSelect={onSelect}
        onOpenFilter={onOpenFilter}
        filterCount={filterCount}
        anchor={anchor}
        onSetAnchor={onSetAnchor}
        onClearAnchor={onClearAnchor}
        viewport={viewport}
      />
    </aside>
  );
}
