'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icons/Icon';
import { Section } from '@/components/ui/Section';
import { FriendProfileWizard, type FriendProfileInitial } from '@/components/friends/FriendProfileWizard';

const EMPTY: FriendProfileInitial = {
  occupation: null,
  work_style: null,
  looking_for: [],
  industry: [],
  gender: null,
  open_to: [],
  bio: null,
};

interface MeResponse {
  signedIn: boolean;
}

interface ProfileResponse {
  profile: {
    occupation: string | null;
    work_style: FriendProfileInitial['work_style'];
    looking_for: string[] | null;
    industry: string[] | null;
    gender: FriendProfileInitial['gender'];
    open_to: string[] | null;
    bio: string | null;
  } | null;
}

export function FriendsBody({
  compact = false,
  onClose,
}: {
  compact?: boolean;
  onClose?: () => void;
}) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [initial, setInitial] = useState<FriendProfileInitial | null>(null);
  const [editing, setEditing] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let aborted = false;
    fetch('/api/me')
      .then((r) => r.json())
      .then((me: MeResponse) => {
        if (aborted) return;
        setSignedIn(Boolean(me.signedIn));
        if (!me.signedIn) {
          setInitial(EMPTY);
          return;
        }
        return fetch('/api/friend-profiles')
          .then((r) => (r.ok ? r.json() : { profile: null }))
          .then((body: ProfileResponse) => {
            if (aborted) return;
            const p = body.profile;
            if (p) {
              setInitial({
                occupation: p.occupation,
                work_style: p.work_style,
                looking_for: p.looking_for ?? [],
                industry: p.industry ?? [],
                gender: p.gender,
                open_to: p.open_to ?? [],
                bio: p.bio,
              });
            } else {
              setInitial(EMPTY);
              setEditing(true);
            }
          });
      })
      .catch(() => {
        if (!aborted) {
          setSignedIn(false);
          setInitial(EMPTY);
        }
      });
    return () => {
      aborted = true;
    };
  }, [savedAt]);

  if (signedIn === null || initial === null) {
    return (
      <div className="flex flex-1 items-center justify-center text-[13px] text-(--text-tertiary)">
        Loading…
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Header title="Cowork" compact={compact} onClose={onClose} />
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-tint text-accent">
            <Icon name="UsersThree" size={28} weight="fill" />
          </div>
          <h2 className="mt-4 text-[18px] font-semibold text-(--text-primary)">
            Sign in to cowork
          </h2>
          <p className="mt-1 text-[13px] text-(--text-secondary)">
            We&apos;ll set up a quick profile (occupation, work style, what you&apos;re looking for)
            so we can match you with people working from the same cafés.
          </p>
          <Link
            href="/auth?next=/waitlist/partners"
            className="mt-5 rounded-2xl bg-accent px-5 py-2.5 text-[14px] font-semibold text-white hover:opacity-90"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Header title="Your cowork profile" compact={compact} onClose={onClose} />
        <FriendProfileWizard
          initial={initial}
          compact={compact}
          onSubmitted={() => {
            setEditing(false);
            setSavedAt(Date.now());
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Header title="Your cowork profile" compact={compact} onClose={onClose} />
      <div
        className={`${
          compact ? 'min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4' : 'mx-auto w-full max-w-2xl px-5 pt-6'
        }`}
      >
        <Section title="You">
          <SummaryRow label="Occupation" value={initial.occupation ?? '—'} />
          <SummaryRow label="Work style" value={prettyWorkStyle(initial.work_style)} />
          <SummaryRow label="Identity" value={prettyGender(initial.gender)} />
          {initial.bio && <SummaryRow label="Bio" value={initial.bio} />}
        </Section>
        <Section title="Looking for">
          <SummaryChips values={initial.looking_for} />
        </Section>
        <Section title="Industry">
          <SummaryChips values={initial.industry} />
        </Section>
        <Section title="Open to">
          <SummaryChips values={initial.open_to} />
        </Section>

        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-4 w-full rounded-2xl border border-(--surface-border) bg-white py-3 text-[14px] font-semibold text-(--text-primary) hover:bg-sys-gray-6 transition"
        >
          Edit profile
        </button>
        <div className="mt-3 rounded-2xl border border-(--surface-border) bg-white p-4 text-[12px] text-(--text-secondary) shadow-card">
          Matching opens up once enough people in your city have profiles. We&apos;ll let you know.
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
          ? 'shrink-0 border-b border-(--surface-border) bg-white/95 backdrop-blur-ios'
          : 'sticky top-0 z-10 border-b border-(--surface-border) bg-white/90 backdrop-blur-ios'
      }
    >
      <div className={`mx-auto flex max-w-2xl items-center justify-between ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
        {compact && onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 text-[13px]">
      <dt className="text-(--text-tertiary)">{label}</dt>
      <dd className="text-right text-(--text-primary)">{value}</dd>
    </div>
  );
}

function SummaryChips({ values }: { values: string[] }) {
  if (values.length === 0) {
    return <span className="text-[12px] text-(--text-tertiary)">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((v) => (
        <span
          key={v}
          className="rounded-full bg-sys-gray-6 px-2.5 py-1 text-[12px] text-(--text-primary)"
        >
          {pretty(v)}
        </span>
      ))}
    </div>
  );
}

function pretty(v: string): string {
  return v
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function prettyWorkStyle(v: FriendProfileInitial['work_style']): string {
  if (!v) return '—';
  return pretty(v);
}

function prettyGender(v: FriendProfileInitial['gender']): string {
  if (!v) return '—';
  return pretty(v);
}
