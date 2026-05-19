'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icons/Icon';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function WaitlistForm({
  list,
  title,
  subtitle,
  extraFields,
}: {
  list: 'partners' | 'business';
  title: string;
  subtitle: string;
  extraFields?: { name: string; label: string; placeholder: string }[];
}) {
  const [email, setEmail] = useState('');
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!EMAIL_RE.test(email)) {
      setError('Please enter a valid email.');
      return;
    }
    try {
      const key = `wic:waitlist:${list}`;
      const existing = JSON.parse(window.localStorage.getItem(key) ?? '[]') as unknown[];
      existing.push({ email, extras, at: Date.now() });
      window.localStorage.setItem(key, JSON.stringify(existing));
    } catch {
      // ignore — demo-only storage
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="mt-8 flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-green-tint">
          <Icon name="CheckCircle" weight="fill" size={44} className="text-accent-green" />
        </div>
        <h2 className="mt-4 text-[22px] font-bold text-(--text-primary)">You&apos;re on the list</h2>
        <p className="mt-1 max-w-sm text-[14px] text-(--text-secondary)">
          We&apos;ll reach out to {email} when we open the {list} program.
        </p>
        <Link
          href="/"
          className="mt-6 rounded-2xl bg-accent px-6 py-3 text-[15px] font-semibold text-white hover:opacity-90 transition"
        >
          Back to map
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8">
      <h1 className="text-[28px] font-bold leading-tight text-(--text-primary)">{title}</h1>
      <p className="mt-2 text-[14px] text-(--text-secondary)">{subtitle}</p>

      <label className="mt-6 block">
        <div className="text-[13px] font-semibold text-(--text-primary)">Email</div>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@domain.com"
          className="mt-1 w-full rounded-xl border border-(--surface-border) bg-white px-4 py-3 text-[15px] text-(--text-primary) placeholder:text-(--text-tertiary) focus:outline-hidden focus:ring-2 focus:ring-accent"
        />
      </label>

      {extraFields?.map((f) => (
        <label key={f.name} className="mt-4 block">
          <div className="text-[13px] font-semibold text-(--text-primary)">{f.label}</div>
          <input
            type="text"
            value={extras[f.name] ?? ''}
            onChange={(e) => setExtras({ ...extras, [f.name]: e.target.value })}
            placeholder={f.placeholder}
            className="mt-1 w-full rounded-xl border border-(--surface-border) bg-white px-4 py-3 text-[15px] text-(--text-primary) placeholder:text-(--text-tertiary) focus:outline-hidden focus:ring-2 focus:ring-accent"
          />
        </label>
      ))}

      {error && (
        <div className="mt-3 rounded-xl bg-accent-red-tint p-3 text-center text-[13px] text-accent-red">
          {error}
        </div>
      )}

      <button
        type="submit"
        className="mt-6 w-full rounded-2xl bg-accent py-3.5 text-[15px] font-semibold text-white hover:opacity-90 transition"
      >
        Join the waitlist
      </button>
      <p className="mt-3 text-center text-[11px] text-(--text-tertiary)">
        Demo storage — saved to your browser&apos;s localStorage. DB wiring lands in Phase 5.
      </p>
    </form>
  );
}
