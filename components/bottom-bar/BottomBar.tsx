'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Icon, type PhosphorIconName } from '@/components/icons/Icon';
import { useLayout } from '@/lib/store/layout';
import { useMediaQuery } from '@/hooks/useMediaQuery';

type SlotKey = 'profile' | 'work' | 'friends';

const HIDDEN_PREFIXES = ['/welcome', '/auth', '/review/new'];

export function BottomBar() {
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const cardOpen = useLayout((s) => s.cardOpen);
  const panel = useLayout((s) => s.panel);
  const setPanel = useLayout((s) => s.setPanel);
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const isMapPage = pathname === '/';
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }
  // Active slot: on the map page (desktop), reflect the panel mode; on mobile
  // and on dedicated routes, reflect the URL.
  const active: SlotKey =
    isDesktop && isMapPage
      ? panel === 'profile'
        ? 'profile'
        : panel === 'friends'
          ? 'friends'
          : 'work'
      : pathname.startsWith('/profile')
        ? 'profile'
        : pathname.startsWith('/waitlist')
          ? 'friends'
          : 'work';

  const goProfile = () => {
    if (isDesktop && isMapPage) setPanel(panel === 'profile' ? null : 'profile');
    else router.push('/profile');
  };
  const goWork = () => {
    if (isDesktop && isMapPage) setPanel(null);
    else router.push('/');
  };
  const goFriends = () => {
    if (isDesktop && isMapPage) setPanel(panel === 'friends' ? null : 'friends');
    else router.push('/waitlist/partners');
  };

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
          onClick={goProfile}
        />
        <Slot
          icon="Coffee"
          label="Work spots"
          active={active === 'work'}
          onClick={goWork}
        />
        <Slot
          icon="UsersThree"
          label="Friends"
          active={active === 'friends'}
          onClick={goFriends}
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
