'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Icon, type PhosphorIconName } from '@/components/icons/Icon';
import { useLayout } from '@/lib/store/layout';

type SlotKey = 'profile' | 'work' | 'meetups';

const HIDDEN_PREFIXES = ['/welcome', '/auth', '/review/new'];

export function BottomBar() {
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const cardOpen = useLayout((s) => s.cardOpen);
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }
  // On mobile, the place card drawer covers the screen — keep the bar out of the way.
  // On desktop, the card is a side panel, so the bar stays.
  const active: SlotKey = pathname.startsWith('/profile')
    ? 'profile'
    : pathname.startsWith('/waitlist')
      ? 'meetups'
      : 'work';

  return (
    <div
      className={`pointer-events-none fixed bottom-5 left-0 right-0 z-30 items-end justify-center px-4 ${
        cardOpen ? 'hidden md:flex' : 'flex'
      }`}
    >
      <div className="pointer-events-auto flex h-16 items-center gap-1 rounded-[32px] border border-[var(--surface-border)] bg-[var(--surface)] px-2 backdrop-blur-ios shadow-float">
        <Slot
          icon="UserCircle"
          label="Profile"
          active={active === 'profile'}
          onClick={() => router.push('/profile')}
        />
        <Slot
          icon="Coffee"
          label="Work spots"
          active={active === 'work'}
          onClick={() => router.push('/')}
        />
        <Slot
          icon="UsersThree"
          label="Meetups"
          active={active === 'meetups'}
          onClick={() => router.push('/waitlist/partners')}
          soon
        />
      </div>
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
      className={`relative flex h-full min-w-[88px] flex-col items-center justify-center gap-0.5 rounded-[28px] px-3 transition hover:bg-white/50 ${
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
