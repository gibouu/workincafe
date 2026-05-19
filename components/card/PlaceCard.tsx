'use client';

import { useState } from 'react';
import { Drawer } from 'vaul';
import type { DemoPlace } from '@/lib/demo/paris-places';
import { PlaceCardBody } from '@/components/card/PlaceCardBody';

// Snap points let iPhone SE users (~568pt height) pull the card up to nearly
// full screen so the inlined Reviews section is reachable. Default is the
// preview snap; dragging the handle up reveals the rest. See #14.
const SNAP_POINTS = [0.55, 0.95];
const DEFAULT_SNAP: number | string = 0.55;

export function PlaceCard({
  place,
  open,
  onOpenChange,
}: {
  place: DemoPlace | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [snap, setSnap] = useState<number | string | null>(DEFAULT_SNAP);
  return (
    <Drawer.Root
      open={open}
      onOpenChange={(o) => {
        if (o) setSnap(DEFAULT_SNAP);
        onOpenChange(o);
      }}
      snapPoints={SNAP_POINTS}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/20 z-40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex h-[97dvh] max-w-md flex-col rounded-t-3xl bg-white shadow-float outline-hidden">
          <Drawer.Title className="sr-only">{place?.name ?? 'Place details'}</Drawer.Title>
          <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-sys-gray-4" />
          {place ? (
            <div className="mt-2 flex min-h-0 flex-1 flex-col">
              <PlaceCardBody place={place} onClose={() => onOpenChange(false)} />
            </div>
          ) : null}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
