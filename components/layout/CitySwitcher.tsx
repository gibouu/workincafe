'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { CITIES, useCity, type City } from '@/lib/store/city';

export function CitySwitcher({ compact = false }: { compact?: boolean }) {
  const city = useCity((s) => s.city);
  const setCity = useCity((s) => s.setCity);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  const current = CITIES[city];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-full ${
          compact
            ? 'border border-[var(--surface-border)] bg-[var(--surface)] backdrop-blur-ios px-3 py-1.5 shadow-float'
            : 'bg-sys-gray-6 px-3 py-1.5'
        } text-[12px] font-medium text-[var(--text-primary)] hover:bg-sys-gray-5 transition`}
      >
        <Icon name="MapPinLine" size={12} />
        <span>{current.label}</span>
        <Icon name="CaretDown" size={10} className="text-[var(--text-secondary)]" />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-40 mt-2 w-48 overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-white shadow-float">
          {(Object.keys(CITIES) as City[]).map((id) => {
            const meta = CITIES[id];
            const active = id === city;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setCity(id);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-[13px] transition ${
                  active
                    ? 'bg-accent-tint text-accent font-semibold'
                    : 'text-[var(--text-primary)] hover:bg-sys-gray-6'
                }`}
              >
                <div>
                  <div>{meta.label}</div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    {meta.places.length} places · {meta.country}
                  </div>
                </div>
                {active && <Icon name="Check" size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
