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
    <Drawer.Root open={open} onOpenChange={onOpenChange} snapPoints={[0.55, 0.9]}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/20 z-40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md rounded-t-3xl bg-white shadow-float outline-none">
          <Drawer.Title className="sr-only">{place?.name ?? 'Place details'}</Drawer.Title>
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-sys-gray-4" />
          {place ? (
            <div className="mt-2 max-h-[92vh] overflow-hidden">
              <PlaceCardBody place={place} onClose={() => onOpenChange(false)} />
            </div>
          ) : null}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
