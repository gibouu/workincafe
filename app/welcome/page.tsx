'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon, type PhosphorIconName } from '@/components/icons/Icon';

interface Slide {
  icon: PhosphorIconName;
  tint: string;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    icon: 'MapTrifold',
    tint: '#007AFF',
    title: 'Find work spots near you',
    body: 'Cafés, libraries, coworking, hotel lobbies — sorted by Wi-Fi, noise, outlets and seat comfort. Built for people working away from home, including abroad.',
  },
  {
    icon: 'PencilSimple',
    tint: '#34C759',
    title: 'Peer reviews + live updates',
    body: 'Drop a full review of a visit, or a quick live update — how loud is it right now, are seats free, what did a coffee cost. Reviews are tailored for remote workers.',
  },
  {
    icon: 'NavigationArrow',
    tint: '#FF9500',
    title: 'Locate yourself precisely',
    body: 'We start near where you are using a rough IP location. Tap the arrow in the top-right to ask for precise GPS — only when you actually need it.',
  },
];

export default function WelcomePage() {
  const [step, setStep] = useState(0);
  const router = useRouter();

  const dismiss = () => {
    try {
      window.localStorage.setItem('wic:onboarded', '1');
    } catch {
      // ignore
    }
    router.replace('/');
  };

  const next = () => {
    if (step < SLIDES.length - 1) setStep(step + 1);
    else dismiss();
  };

  const slide = SLIDES[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-[var(--surface-border)] bg-white shadow-float">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-sys-gray-6 text-[var(--text-secondary)] hover:bg-sys-gray-5 transition"
        >
          <Icon name="X" size={14} />
        </button>

        <div className="px-6 pt-8 pb-5">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl shadow-card"
            style={{ background: slide.tint }}
          >
            <Icon name={slide.icon} size={32} weight="fill" className="text-white" />
          </div>

          <h2 className="mt-5 text-center text-[20px] font-semibold leading-tight text-[var(--text-primary)]">
            {slide.title}
          </h2>
          <p className="mt-2 text-center text-[13px] leading-snug text-[var(--text-secondary)]">
            {slide.body}
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--surface-border)] px-5 py-3">
          <div className="flex items-center gap-1.5">
            {SLIDES.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'w-5 bg-[var(--text-primary)]' : 'w-1.5 bg-sys-gray-4'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="rounded-full px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-sys-gray-6 transition"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="rounded-full bg-accent px-4 py-1.5 text-[13px] font-semibold text-white hover:opacity-90 transition"
            >
              {step === SLIDES.length - 1 ? 'Got it' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
