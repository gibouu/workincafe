'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Icon } from '@/components/icons/Icon';

export default function AuthPage() {
  const [loading, setLoading] = useState<'google' | 'apple' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const getSafeNext = () => {
    const next = new URLSearchParams(window.location.search).get('next') ?? '/profile';
    return next.startsWith('/') && !next.startsWith('//') ? next : '/profile';
  };

  const signIn = async (provider: 'google' | 'apple') => {
    setLoading(provider);
    setError(null);
    try {
      const supabase = createClient();
      const next = getSafeNext();
      const callback = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: callback,
        },
      });
      if (authError) throw authError;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
      setLoading(null);
    }
  };

  const dismiss = () => {
    router.replace('/');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4"
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-[var(--surface-border)] bg-white shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-sys-gray-6 text-[var(--text-secondary)] hover:bg-sys-gray-5 transition"
        >
          <Icon name="X" size={14} />
        </button>

        <div className="px-6 pt-8 pb-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-card">
            <Icon name="Coffee" weight="fill" size={32} className="text-[#6B4F3B]" />
          </div>
          <h1 className="mt-5 text-center text-[22px] font-bold leading-tight text-[var(--text-primary)]">
            Work in Cafe
          </h1>
          <p className="mt-1 text-center text-[13px] text-[var(--text-secondary)]">
            Sign in to save places, post reviews, and check in.
          </p>

          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => signIn('apple')}
              disabled={loading !== null}
              className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--text-primary)] py-3 text-[14px] font-semibold text-white hover:opacity-90 disabled:opacity-60 transition"
            >
              <Icon
                name={loading === 'apple' ? 'CircleNotch' : 'AppleLogo'}
                size={16}
                weight="fill"
                className={loading === 'apple' ? 'animate-spin' : ''}
              />
              <span>Continue with Apple</span>
            </button>

            <button
              type="button"
              onClick={() => signIn('google')}
              disabled={loading !== null}
              className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--surface-border)] bg-white py-3 text-[14px] font-semibold text-[var(--text-primary)] hover:bg-sys-gray-6 disabled:opacity-60 transition"
            >
              <Icon
                name={loading === 'google' ? 'CircleNotch' : 'GoogleLogo'}
                size={16}
                className={loading === 'google' ? 'animate-spin' : ''}
              />
              <span>Continue with Google</span>
            </button>

            {error && (
              <div className="rounded-2xl bg-accent-red-tint p-3 text-center text-[12px] text-accent-red">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={dismiss}
              className="mt-1 text-center text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
            >
              Continue as guest
            </button>
          </div>

          <div className="mt-5 text-center text-[10px] text-[var(--text-tertiary)]">
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
      </div>
    </div>
  );
}
