'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icons/Icon';
import { ProfileTabs } from '@/components/profile/ProfileTabs';
import { SignOutButton } from '@/components/auth/SignOutButton';

interface MeResponse {
  signedIn: boolean;
  name: string | null;
  email: string | null;
  isDemo: boolean;
}

export function ProfileBody({
  compact = false,
  onClose,
}: {
  compact?: boolean;
  onClose?: () => void;
}) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: MeResponse | null) => {
        setMe(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return (
      <div className="flex flex-1 items-center justify-center text-[13px] text-[var(--text-tertiary)]">
        Loading…
      </div>
    );
  }

  if (!me?.signedIn) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Header title="Profile" compact={compact} onClose={onClose} />
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sys-gray-6 text-[var(--text-secondary)]">
            <Icon name="UserCircle" size={36} />
          </div>
          <h2 className="mt-4 text-[18px] font-semibold text-[var(--text-primary)]">
            Sign in to see your profile
          </h2>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            Saved places, your reviews, your loyalty points — all in one spot.
          </p>
          <Link
            href="/auth"
            className="mt-5 rounded-2xl bg-accent px-5 py-2.5 text-[14px] font-semibold text-white hover:opacity-90"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Header title="Profile" compact={compact} onClose={onClose} />
      <div
        className={`${
          compact ? 'min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4' : 'mx-auto w-full max-w-2xl px-5 pt-6'
        }`}
      >
        <div className="flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sys-gray-5 text-[var(--text-secondary)]">
            <Icon name="UserCircle" size={48} />
          </div>
          <div className="mt-3 text-[18px] font-semibold text-[var(--text-primary)]">
            {me.name ?? 'Traveller'}
          </div>
          {me.email && (
            <div className="mt-1 text-[12px] text-[var(--text-secondary)]">{me.email}</div>
          )}
        </div>

        <div className="mt-6">
          <ProfileTabs />
        </div>

        <div className="mt-6">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}

function Header({
  title,
  compact,
  onClose,
}: {
  title: string;
  compact: boolean;
  onClose?: () => void;
}) {
  return (
    <header
      className={
        compact
          ? 'shrink-0 border-b border-[var(--surface-border)] bg-white/95 backdrop-blur-ios'
          : 'sticky top-0 z-10 border-b border-[var(--surface-border)] bg-white/90 backdrop-blur-ios'
      }
    >
      <div className={`mx-auto flex max-w-2xl items-center justify-between ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
        {compact && onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-sys-gray-6"
          >
            <Icon name="X" size={14} />
          </button>
        ) : (
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-sys-gray-6"
            aria-label="Back to map"
          >
            <Icon name="ArrowLeft" size={18} />
          </Link>
        )}
        <div className={compact ? 'text-[13px] font-semibold' : 'text-[15px] font-semibold'}>
          {title}
        </div>
        <div className={compact ? 'w-8' : 'w-9'} />
      </div>
    </header>
  );
}
