'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon, type PhosphorIconName } from '@/components/icons/Icon';
import { SearchBar } from '@/components/search/SearchBar';
import type { DemoPlace } from '@/lib/demo/paris-places';

type SlotKey = 'profile' | 'home' | 'partners';

export function BottomBar({ onSelectPlace }: { onSelectPlace: (p: DemoPlace) => void }) {
  const [active, setActive] = useState<SlotKey>('home');
  const router = useRouter();

  return (
    <div className="pointer-events-none absolute bottom-5 left-0 right-0 z-30 flex items-end justify-center gap-3 px-4">
      <div className="pointer-events-auto flex h-16 items-center gap-1 rounded-[32px] border border-[var(--surface-border)] bg-[var(--surface)] px-2 backdrop-blur-ios shadow-float">
        <Slot
          icon="UserCircle"
          label="Profile"
          active={active === 'profile'}
          onClick={() => {
            setActive('profile');
            router.push('/profile');
          }}
        />
        <Slot
          icon="Coffee"
          label="Cafés"
          active={active === 'home'}
          onClick={() => setActive('home')}
        />
        <Slot
          icon="UsersThree"
          label="Partners"
          onClick={() => router.push('/waitlist/partners')}
          soon
        />
      </div>

      <SearchBar onSelect={onSelectPlace} />
    </div>
  );
}

function Slot({
  icon,
  label,
  active,
  soon,
  onClick,
}: {
  icon: PhosphorIconName;
  label: string;
  active?: boolean;
  soon?: boolean;
  onClick?: () => void;
}) {
  const muted = Boolean(soon);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex h-full min-w-[80px] flex-col items-center justify-center gap-0.5 rounded-[28px] px-3 transition hover:bg-white/50 ${
        active ? 'text-accent' : muted ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'
      }`}
    >
      <Icon name={icon} size={24} weight={active ? 'fill' : 'regular'} />
      <span className="text-[11px] font-medium leading-none">{label}</span>
      {active && <span className="absolute bottom-1 h-0.5 w-5 rounded-full bg-accent" />}
      {soon && (
        <span className="absolute -top-1 -right-1 rounded-full bg-sys-gray-5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Soon
        </span>
      )}
    </button>
  );
}
