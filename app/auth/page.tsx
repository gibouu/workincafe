'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Icon } from '@/components/icons/Icon';

// The user-facing app stays OAuth-only (Google + Apple). Magic-link is
// available *only* to owner-context flows so a restaurant operator without
// an Apple ID or who doesn't want to link Google can still claim their
// place. See #21. Owner-context = the auth modal was opened with a `next`
// path that lands inside the owner / claim flow.
function isOwnerContext(next: string): boolean {
  if (next.startsWith('/owner') || next.startsWith('/owner/')) return true;
  if (/^\/place\/[^/]+\/claim(\/|$|\?)/.test(next)) return true;
  return false;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function AuthPage() {
  const [loading, setLoading] = useState<'google' | 'apple' | 'magic' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Owner-context detection has to wait for hydration — read window.location
  // on mount, then never re-read.
  const [ownerContext, setOwnerContext] = useState(false);
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [email, setEmail] = useState('');
  const [magicSent, setMagicSent] = useState(false);

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get('next') ?? '/';
    setOwnerContext(isOwnerContext(next));
  }, []);

  const getSafeNext = () => {
    const next = new URLSearchParams(window.location.search).get('next') ?? '/';
    return next.startsWith('/') && !next.startsWith('//') ? next : '/';
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

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) {
      setError('Enter a valid email');
      return;
    }
    setLoading('magic');
    setError(null);
    try {
      const supabase = createClient();
      const next = getSafeNext();
      const callback = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: callback,
        },
      });
      if (authError) throw authError;
      setMagicSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send magic link');
    } finally {
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
            {magicSent
              ? 'Check your email for the sign-in link.'
              : 'Sign in to save places, post reviews, and check in.'}
          </p>

          {magicSent ? (
            <div className="mt-6 flex flex-col gap-2.5">
              <div className="rounded-2xl bg-accent-tint p-4 text-center">
                <Icon
                  name="EnvelopeSimple"
                  size={28}
                  weight="fill"
                  className="mx-auto text-accent"
                />
                <div className="mt-2 text-[14px] font-semibold text-[var(--text-primary)]">
                  Sent to {email}
                </div>
                <div className="mt-1 text-[12px] text-[var(--text-secondary)]">
                  Click the link in your inbox to finish signing in. The link expires in 60 minutes.
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMagicSent(false);
                  setShowMagicLink(false);
                  setEmail('');
                }}
                className="mt-1 text-center text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
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

                {/* Owner-only magic link entry point. Hidden on consumer flows
                    so we don't pollute the user app with email auth (#21). */}
                {ownerContext && !showMagicLink && (
                  <button
                    type="button"
                    onClick={() => setShowMagicLink(true)}
                    disabled={loading !== null}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--surface-border)] bg-white py-3 text-[14px] font-medium text-[var(--text-primary)] hover:bg-sys-gray-6 disabled:opacity-60 transition"
                  >
                    <Icon name="EnvelopeSimple" size={16} />
                    <span>Sign in with email instead</span>
                  </button>
                )}

                {ownerContext && showMagicLink && (
                  <form onSubmit={sendMagicLink} className="flex flex-col gap-2.5">
                    <div className="flex items-center gap-2 rounded-2xl border border-[var(--surface-border)] bg-white px-3 py-2.5 focus-within:ring-2 focus-within:ring-accent">
                      <Icon name="EnvelopeSimple" size={16} className="text-[var(--text-secondary)]" />
                      <input
                        type="email"
                        autoComplete="email"
                        autoFocus
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (error) setError(null);
                        }}
                        placeholder="you@yourplace.com"
                        className="flex-1 bg-transparent text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading !== null || !EMAIL_RE.test(email)}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-accent py-3 text-[14px] font-semibold text-white hover:opacity-90 disabled:opacity-60 transition"
                    >
                      {loading === 'magic' ? (
                        <Icon name="CircleNotch" size={16} className="animate-spin" />
                      ) : null}
                      <span>{loading === 'magic' ? 'Sending…' : 'Send magic link'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowMagicLink(false);
                        setEmail('');
                        setError(null);
                      }}
                      className="text-center text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
                    >
                      Back to OAuth
                    </button>
                  </form>
                )}

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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
