'use client';

import { useState } from 'react';
import { Icon } from '@/components/icons/Icon';

export function AttributionPill() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="About this map"
        title="About this map"
        className="pointer-events-auto absolute bottom-2 left-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-white/70 text-(--text-tertiary) backdrop-blur-ios hover:bg-white"
      >
        <Icon name="Info" size={14} />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 px-4 pb-6 backdrop-blur-xs md:items-center md:pb-0"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-(--surface-border) bg-white p-5 shadow-float"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[15px] font-semibold text-(--text-primary)">
                  About this map
                </div>
                <p className="mt-1 text-[12px] text-(--text-secondary)">
                  Map data and tiles are openly licensed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sys-gray-6 text-(--text-secondary) hover:bg-sys-gray-5"
              >
                <Icon name="X" size={12} />
              </button>
            </div>
            <ul className="mt-4 space-y-2 text-[13px] text-(--text-primary)">
              <li>
                Data ©{' '}
                <a
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  OpenStreetMap contributors
                </a>
              </li>
              <li>
                Tiles by{' '}
                <a
                  href="https://openfreemap.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  OpenFreeMap
                </a>
              </li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
