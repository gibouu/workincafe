'use client';

import { Drawer } from 'vaul';
import type { DemoPlace } from '@/lib/demo/paris-places';
import { PlaceCardBody } from '@/components/card/PlaceCardBody';

export function PlaceCard({
  place,
  open,
  onOpenChange,
}: {
  place: DemoPlace | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/20 z-40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex h-[88dvh] max-w-md flex-col rounded-t-3xl bg-white shadow-float outline-none">
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
