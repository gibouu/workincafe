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
    <div className="pointer-events-none absolute top-4 right-4 z-30 flex h-[calc(100vh-2rem)] w-[360px] flex-col">
      <div className="pointer-events-auto flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-white/95 backdrop-blur-ios shadow-float">
        <PlaceCardBody place={place} onClose={onClose} />
      </div>
    </div>
  );
}
