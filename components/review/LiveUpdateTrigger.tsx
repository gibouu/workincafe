'use client';

import { useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { LiveUpdateSheet } from '@/components/review/LiveUpdateSheet';
import type { DemoPlace } from '@/lib/demo/paris-places';

export function LiveUpdateTrigger({ place }: { place: DemoPlace }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-(--surface-border) bg-white py-3 text-[14px] font-semibold text-(--text-primary) hover:bg-sys-gray-6 transition"
      >
        <Icon name="Broadcast" size={18} />
        <span>Share a live update</span>
      </button>
      <LiveUpdateSheet place={place} open={open} onOpenChange={setOpen} />
    </>
  );
}
