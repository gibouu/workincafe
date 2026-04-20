'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Icon } from '@/components/icons/Icon';

export default function AuthPage() {
  const [loading, setLoading] = useState<'google' | 'apple' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (provider: 'google' | 'apple') => {
    setLoading(provider);
    setError(null);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (authError) throw authError;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
      setLoading(null);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--map-bg)]">
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-card">
          <Icon name="Coffee" weight="fill" size={36} className="text-[#6B4F3B]" />
        </div>
        <h1 className="mt-6 text-center text-[34px] font-bold leading-tight text-[var(--text-primary)]">
          Work in Cafe
        </h1>
        <p className="mt-2 max-w-xs text-center text-[15px] text-[var(--text-secondary)]">
          Find places to work or study outside the home.
        </p>

        <div className="mt-10 flex w-full max-w-sm flex-col gap-3">
          <button
            type="button"
            onClick={() => signIn('apple')}
            disabled={loading !== null}
            className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--text-primary)] py-3.5 text-[15px] font-semibold text-white hover:opacity-90 disabled:opacity-60 transition"
          >
            <Icon
              name={loading === 'apple' ? 'CircleNotch' : 'AppleLogo'}
              size={18}
              weight="fill"
              className={loading === 'apple' ? 'animate-spin' : ''}
            />
            <span>Continue with Apple</span>
          </button>

          <button
            type="button"
            onClick={() => signIn('google')}
            disabled={loading !== null}
            className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--surface-border)] bg-white py-3.5 text-[15px] font-semibold text-[var(--text-primary)] hover:bg-sys-gray-6 disabled:opacity-60 transition"
          >
            <Icon
              name={loading === 'google' ? 'CircleNotch' : 'GoogleLogo'}
              size={18}
              className={loading === 'google' ? 'animate-spin' : ''}
            />
            <span>Continue with Google</span>
          </button>

          {error && (
            <div className="rounded-2xl bg-accent-red-tint p-3 text-center text-[13px] text-accent-red">
              {error}
            </div>
          )}

          <Link
            href="/"
            className="mt-2 text-center text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
          >
            Continue as guest
          </Link>
        </div>
      </div>

      <div className="px-6 pb-8 text-center text-[11px] text-[var(--text-tertiary)]">
        By continuing you agree to our{' '}
        <Link href="/legal/tos" className="underline">
          Terms
        </Link>{' '}
        and{' '}
        <Link href="/legal/privacy" className="underline">
          Privacy Policy
        </Link>
        .
      </div>
    </div>
  );
}
