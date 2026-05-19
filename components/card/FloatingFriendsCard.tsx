'use client';

import { FriendsBody } from '@/components/friends/FriendsBody';

export function FloatingFriendsCard({ onClose }: { onClose: () => void }) {
  return (
    <div className="pointer-events-none absolute top-4 right-4 z-30 flex h-[calc(100vh-2rem)] w-[360px] flex-col">
      <div className="pointer-events-auto flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-(--surface-border) bg-white/95 backdrop-blur-ios shadow-float">
        <FriendsBody compact onClose={onClose} />
      </div>
    </div>
  );
}
