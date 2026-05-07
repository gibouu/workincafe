'use client';

import { Drawer } from 'vaul';
import Image from 'next/image';
import { Icon } from '@/components/icons/Icon';
import { CLOUDINARY_CLOUD_NAME } from '@/lib/cloudinary';

export interface PlaceMenu {
  id: string;
  label: string | null;
  cloudinary_public_id: string;
  cloudinary_version: string | null;
  width: number | null;
  height: number | null;
}

function menuUrl(m: PlaceMenu): string {
  if (!CLOUDINARY_CLOUD_NAME) return '';
  const version = m.cloudinary_version ? `${m.cloudinary_version}/` : '';
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${version}${m.cloudinary_public_id}`;
}

export function MenuSheet({
  open,
  onOpenChange,
  placeName,
  menus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeName: string;
  menus: PlaceMenu[];
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/30" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-[70] mx-auto flex h-[92dvh] max-w-2xl flex-col rounded-t-3xl bg-[var(--map-bg)] shadow-float outline-none">
          <Drawer.Title className="sr-only">Menus — {placeName}</Drawer.Title>
          <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-sys-gray-4" />

          <div className="flex items-start justify-between gap-3 px-5 pt-3">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
                Menu
              </div>
              <div className="truncate text-[17px] font-semibold text-[var(--text-primary)]">
                {placeName}
              </div>
              <div className="text-[11px] text-[var(--text-tertiary)]">
                {menus.length} {menus.length === 1 ? 'photo' : 'photos'} · uploaded by the owner
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sys-gray-6 text-[var(--text-secondary)] hover:bg-sys-gray-5 transition"
            >
              <Icon name="X" size={14} />
            </button>
          </div>

          <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-5 pb-6">
            {menus.length === 0 ? (
              <div className="rounded-2xl border border-[var(--surface-border)] bg-white p-6 text-center text-[13px] text-[var(--text-secondary)]">
                No menus posted yet.
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {menus.map((m) => {
                  const url = menuUrl(m);
                  if (!url) return null;
                  const aspect =
                    m.width && m.height ? `${m.width} / ${m.height}` : '4 / 5';
                  return (
                    <li
                      key={m.id}
                      className="overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-white shadow-card"
                    >
                      <div className="relative w-full" style={{ aspectRatio: aspect }}>
                        <Image
                          src={url}
                          alt={m.label ?? 'Menu'}
                          fill
                          sizes="(max-width: 768px) 100vw, 768px"
                          className="object-contain"
                        />
                      </div>
                      {m.label && (
                        <div className="border-t border-[var(--surface-border)] px-3 py-2 text-[12px] text-[var(--text-secondary)]">
                          {m.label}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
