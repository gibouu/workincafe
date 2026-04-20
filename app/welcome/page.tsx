'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icons/Icon';

type Step = 'intro' | 'location' | 'signin';

export default function WelcomePage() {
  const [step, setStep] = useState<Step>('intro');
  const router = useRouter();

  const dismiss = () => {
    try {
      window.localStorage.setItem('wic:onboarded', '1');
    } catch {
      // ignore
    }
    router.replace('/');
  };

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--map-bg)]">
      <header className="flex justify-end px-5 pt-5">
        <button
          type="button"
          onClick={dismiss}
          className="text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
        >
          Skip
        </button>
      </header>

      <main className="flex flex-1 flex-col px-6">
        {step === 'intro' && (
          <Step
            title="Find a place to work"
            subtitle="Cafés, bakeries, libraries, coworking — tuned to Wi-Fi, noise, outlets, and seat comfort."
            hero="Coffee"
            heroTint="#6B4F3B"
            primaryLabel="Continue"
            onPrimary={() => setStep('location')}
          />
        )}

        {step === 'location' && (
          <Step
            title="Use your location"
            subtitle="We use GPS to show nearby places, verify check-ins, and filter reviews for honesty."
            hero="NavigationArrow"
            heroTint="#007AFF"
            primaryLabel="Allow location"
            onPrimary={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  () => setStep('signin'),
                  () => setStep('signin'),
                  { timeout: 8000 },
                );
              } else {
                setStep('signin');
              }
            }}
            secondaryLabel="Not now"
            onSecondary={() => setStep('signin')}
          />
        )}

        {step === 'signin' && (
          <Step
            title="Save your favorites"
            subtitle="Sign in to leave reviews, save spots, and build a trust score. Or skip and browse as a guest."
            hero="Heart"
            heroTint="#FF3B30"
            primaryLabel="Sign in"
            onPrimary={() => router.replace('/auth')}
            secondaryLabel="Browse as guest"
            onSecondary={dismiss}
          />
        )}
      </main>

      <footer className="flex items-center justify-center gap-2 pb-8">
        <Dot active={step === 'intro'} />
        <Dot active={step === 'location'} />
        <Dot active={step === 'signin'} />
      </footer>

      <div className="px-6 pb-6 text-center text-[11px] text-[var(--text-tertiary)]">
        Place data © OpenStreetMap contributors · Maps © Apple
      </div>
      {/* Hidden hook so server navigation can read sign-in */}
      <Link href="/auth" className="hidden" aria-hidden="true">
        sign in
      </Link>
    </div>
  );
}

function Step({
  title,
  subtitle,
  hero,
  heroTint,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  title: string;
  subtitle: string;
  hero:
    | 'Coffee'
    | 'NavigationArrow'
    | 'Heart';
  heroTint: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center">
        <div
          className="flex h-24 w-24 items-center justify-center rounded-3xl shadow-card"
          style={{ background: heroTint }}
        >
          <Icon name={hero} size={52} weight="fill" className="text-white" />
        </div>
        <h1 className="mt-8 text-center text-[34px] font-bold leading-tight text-[var(--text-primary)]">
          {title}
        </h1>
        <p className="mt-3 max-w-sm text-center text-[15px] text-[var(--text-secondary)]">
          {subtitle}
        </p>
      </div>

      <div className="flex flex-col gap-3 pb-6">
        <button
          type="button"
          onClick={onPrimary}
          className="w-full rounded-2xl bg-accent py-3.5 text-[15px] font-semibold text-white hover:opacity-90 transition"
        >
          {primaryLabel}
        </button>
        {secondaryLabel && onSecondary && (
          <button
            type="button"
            onClick={onSecondary}
            className="w-full text-center text-[14px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function Dot({ active }: { active: boolean }) {
  return (
    <div
      className={`h-1.5 rounded-full transition ${
        active ? 'w-6 bg-[var(--text-primary)]' : 'w-1.5 bg-sys-gray-4'
      }`}
    />
  );
}
