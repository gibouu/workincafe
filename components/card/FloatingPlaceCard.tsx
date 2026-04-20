'use client';

import type { DemoPlace } from '@/lib/demo/paris-places';
import { PlaceCardBody } from '@/components/card/PlaceCardBody';

export function FloatingPlaceCard({
  place,
  onClose,
}: {
  place: DemoPlace | null;
  onClose: () => void;
}) {
  if (!place) return null;
  return (
    <div className="pointer-events-none absolute top-4 right-4 z-30 w-[360px] max-h-[calc(100%-2rem)]">
      <div className="pointer-events-auto overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-white/95 backdrop-blur-ios shadow-float">
        <div className="max-h-[calc(100vh-2rem)] overflow-y-auto">
          <PlaceCardBody place={place} onClose={onClose} />
        </div>
      </div>
    </div>
  );
}
