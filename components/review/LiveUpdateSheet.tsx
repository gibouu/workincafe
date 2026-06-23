'use client';

import { useEffect, useState } from 'react';
import { Drawer } from 'vaul';
import { Icon, type PhosphorIconName } from '@/components/icons/Icon';
import type { DemoPlace } from '@/lib/demo/paris-places';
import { categoryMeta } from '@/lib/categories';
import { useToasts } from '@/lib/store/toasts';
import { savePending, buildAuthRedirect } from '@/lib/auth/pending-submit';
import { runSpeedtest } from '@/lib/measurement/speedtest';
import { runDecibelTest } from '@/lib/measurement/decibel';
import { isLiveUpdateSubmitSuccess } from '@/lib/live-updates/submission-status';

type Noise = 'quiet' | 'moderate' | 'loud';
type Seating = 'plenty' | 'some' | 'full';
type Temperature = 'cold' | 'comfortable' | 'warm' | 'hot';
type Outlets = 'many' | 'some' | 'none';

type RotatingKey = 'drink_price' | 'bathrooms' | 'stay_limit' | 'wifi_present' | 'has_outdoor';

interface RotatingQuestion {
  key: RotatingKey;
  prompt: string;
  options: { value: string; label: string }[];
}

const ROTATING_QUESTIONS: RotatingQuestion[] = [
  {
    key: 'drink_price',
    prompt: 'Drink price?',
    options: [
      { value: 'lt3', label: '<€3' },
      { value: '3_5', label: '€3–5' },
      { value: '5_8', label: '€5–8' },
      { value: 'gte8', label: '€8+' },
    ],
  },
  {
    key: 'bathrooms',
    prompt: 'Bathrooms available?',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'customers', label: 'Customers only' },
      { value: 'no', label: 'No' },
    ],
  },
  {
    key: 'stay_limit',
    prompt: 'Stay limit?',
    options: [
      { value: '1', label: '1h' },
      { value: '2', label: '2h' },
      { value: '4', label: '4h' },
      { value: 'all_day', label: 'All day' },
    ],
  },
  {
    key: 'wifi_present',
    prompt: 'Wi-Fi available?',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'paid', label: 'Paid / login' },
      { value: 'no', label: 'No' },
    ],
  },
  {
    key: 'has_outdoor',
    prompt: 'Outdoor seating?',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'seasonal', label: 'Seasonal' },
      { value: 'no', label: 'No' },
    ],
  },
];

function pickRotatingQuestion(placeId: string): RotatingQuestion {
  let hash = 0;
  for (let i = 0; i < placeId.length; i++) {
    hash = (hash * 31 + placeId.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % ROTATING_QUESTIONS.length;
  return ROTATING_QUESTIONS[idx];
}

type Step = 'now' | 'optional';
const STEPS: Step[] = ['now', 'optional'];
const STEP_TITLES: Record<Step, string> = {
  now: 'Right now',
  optional: 'Anything else?',
};

export function LiveUpdateSheet({
  place,
  open,
  onOpenChange,
}: {
  place: DemoPlace | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = useState<Step>('now');
  const [noise, setNoise] = useState<Noise | null>(null);
  const [seating, setSeating] = useState<Seating | null>(null);
  const [temperature, setTemperature] = useState<Temperature | null>(null);
  const [outlets, setOutlets] = useState<Outlets | null>(null);
  const [rotatingAnswer, setRotatingAnswer] = useState<string | null>(null);
  const [wifiMbps, setWifiMbps] = useState<number | null>(null);
  const [wifiLoading, setWifiLoading] = useState(false);
  const [decibel, setDecibel] = useState<number | null>(null);
  const [decibelLoading, setDecibelLoading] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const showToast = useToasts((s) => s.show);
  const rotating = place ? pickRotatingQuestion(place.id) : null;

  // Best-effort auth status check on open. Used for the inline sign-in hint
  // so users see "you'll be asked to sign in to save" before they fill the
  // form, instead of finding out only at submit (the original UX).
  useEffect(() => {
    if (!open) return;
    let aborted = false;
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : { signedIn: false }))
      .then((data: { signedIn?: boolean }) => {
        if (!aborted) setSignedIn(Boolean(data.signedIn));
      })
      .catch(() => {
        if (!aborted) setSignedIn(false);
      });
    return () => {
      aborted = true;
    };
  }, [open]);

  const runWifi = async () => {
    setWifiLoading(true);
    try {
      const r = await runSpeedtest();
      setWifiMbps(r.download_mbps);
    } catch {
      setWifiMbps(null);
    }
    setWifiLoading(false);
  };

  const runSound = async () => {
    setDecibelLoading(true);
    try {
      const r = await runDecibelTest(10);
      const db = Math.round(r.avg_db);
      setDecibel(db);
      // Auto-fill the noise question from the measurement.
      const bucket: Noise = db < 50 ? 'quiet' : db < 65 ? 'moderate' : 'loud';
      setNoise(bucket);
    } catch {
      setDecibel(null);
    }
    setDecibelLoading(false);
  };

  const reset = () => {
    setStep('now');
    setNoise(null);
    setSeating(null);
    setTemperature(null);
    setOutlets(null);
    setRotatingAnswer(null);
    setWifiMbps(null);
    setDecibel(null);
    setSubmitting(false);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const canAdvance =
    noise !== null && seating !== null && temperature !== null && outlets !== null;
  const stepIndex = STEPS.indexOf(step);
  const isLast = stepIndex === STEPS.length - 1;

  const goNext = () => {
    if (!canAdvance) return;
    setStep(STEPS[stepIndex + 1]);
  };
  const goBack = () => {
    if (stepIndex === 0) handleClose(false);
    else setStep(STEPS[stepIndex - 1]);
  };

  const onSubmit = async () => {
    if (!canAdvance || !place || submitting) return;
    setSubmitting(true);
    const body = {
      place_id: place.id,
      noise_level: noise,
      seating_availability: seating,
      temperature,
      outlets,
      ...(wifiMbps !== null ? { wifi_mbps: wifiMbps } : {}),
      ...(decibel !== null ? { decibel_db: decibel } : {}),
      ...(rotating && rotatingAnswer
        ? { rotating_question: rotating.prompt, rotating_answer: rotatingAnswer }
        : {}),
    };
    try {
      const resp = await fetch('/api/live-updates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (resp.status === 401) {
        savePending('live-update', place.id, body);
        const nextPath =
          typeof window !== 'undefined'
            ? window.location.pathname + window.location.search
            : '/';
        window.location.assign(buildAuthRedirect(nextPath, 'live-update'));
        return;
      }
      // 404/503 (table/column missing) → still treat as success in demo mode.
      if (!isLiveUpdateSubmitSuccess(resp)) {
        showToast('Could not share update', { tone: 'error' });
        setSubmitting(false);
        return;
      }
      showToast(`Update shared for ${place.name}`);
      handleClose(false);
    } catch {
      showToast('Could not share update', { tone: 'error' });
      setSubmitting(false);
    }
  };

  return (
    <Drawer.Root open={open} onOpenChange={handleClose}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/20 z-40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex h-[88dvh] max-w-md flex-col rounded-t-3xl bg-white shadow-float outline-hidden">
          <Drawer.Title className="sr-only">Live review</Drawer.Title>
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-sys-gray-4" />

          {place ? (
            <FormBody
              place={place}
              step={step}
              stepIndex={stepIndex}
              isLast={isLast}
              canAdvance={canAdvance}
              signedIn={signedIn}
              submitting={submitting}
              noise={noise}
              setNoise={setNoise}
              seating={seating}
              setSeating={setSeating}
              temperature={temperature}
              setTemperature={setTemperature}
              outlets={outlets}
              setOutlets={setOutlets}
              rotating={rotating}
              rotatingAnswer={rotatingAnswer}
              setRotatingAnswer={setRotatingAnswer}
              wifiMbps={wifiMbps}
              wifiLoading={wifiLoading}
              onRunWifi={runWifi}
              decibel={decibel}
              decibelLoading={decibelLoading}
              onRunSound={runSound}
              onClose={() => handleClose(false)}
              goBack={goBack}
              goNext={goNext}
              onSubmit={onSubmit}
            />
          ) : null}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

interface FormBodyProps {
  place: DemoPlace;
  step: Step;
  stepIndex: number;
  isLast: boolean;
  canAdvance: boolean;
  signedIn: boolean | null;
  submitting: boolean;
  noise: Noise | null;
  setNoise: (v: Noise) => void;
  seating: Seating | null;
  setSeating: (v: Seating) => void;
  temperature: Temperature | null;
  setTemperature: (v: Temperature) => void;
  outlets: Outlets | null;
  setOutlets: (v: Outlets) => void;
  rotating: RotatingQuestion | null;
  rotatingAnswer: string | null;
  setRotatingAnswer: (v: string | null) => void;
  wifiMbps: number | null;
  wifiLoading: boolean;
  onRunWifi: () => void;
  decibel: number | null;
  decibelLoading: boolean;
  onRunSound: () => void;
  onClose: () => void;
  goBack: () => void;
  goNext: () => void;
  onSubmit: () => void;
}

function FormBody(props: FormBodyProps) {
  const { place, step, stepIndex, isLast, canAdvance, signedIn, submitting, onClose, goBack, goNext, onSubmit } = props;
  const meta = categoryMeta(place.category);
  return (
    <>
      <header className="border-b border-(--surface-border) px-5 pb-3 pt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-bubble"
              style={{ background: meta.color }}
            >
              <Icon name={meta.icon} size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-(--text-secondary)">
                Step {stepIndex + 1} of {STEPS.length} · {STEP_TITLES[step]}
              </div>
              <div className="truncate text-[17px] font-semibold text-(--text-primary)">
                {place.name}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sys-gray-6 text-(--text-secondary)"
          >
            <Icon name="X" size={14} />
          </button>
        </div>
        <div className="mt-3 flex gap-1">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= stepIndex ? 'bg-accent' : 'bg-sys-gray-5'
              }`}
            />
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {signedIn === false && (
          <div className="mb-4 flex items-start gap-2 rounded-2xl border border-(--surface-border) bg-accent-tint p-3 text-[12px] text-(--text-primary)">
            <Icon name="Info" size={14} className="mt-0.5 shrink-0 text-accent" />
            <div>
              You&apos;re not signed in. Fill this out — we&apos;ll save your draft and ask you to
              sign in only when you submit.
            </div>
          </div>
        )}

        {step === 'now' ? <StepNow {...props} /> : <StepOptional {...props} />}
      </div>

      <div className="border-t border-(--surface-border) p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={goBack}
            disabled={submitting}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-(--surface-border) bg-white text-(--text-primary) hover:bg-sys-gray-6 disabled:opacity-60"
            aria-label={stepIndex === 0 ? 'Cancel' : 'Back'}
          >
            <Icon name="ArrowLeft" size={20} />
          </button>
          <div className="flex-1">
            {isLast ? (
              <button
                type="button"
                onClick={onSubmit}
                disabled={!canAdvance || submitting}
                className="w-full rounded-2xl bg-accent py-3.5 text-[15px] font-semibold text-white hover:opacity-90 disabled:bg-sys-gray-4 disabled:cursor-not-allowed transition"
              >
                {submitting ? 'Submitting…' : 'Share update'}
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                disabled={!canAdvance}
                className="w-full rounded-2xl bg-accent py-3.5 text-[15px] font-semibold text-white hover:opacity-90 disabled:bg-sys-gray-4 disabled:cursor-not-allowed transition"
              >
                Continue
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function StepNow({
  noise,
  setNoise,
  seating,
  setSeating,
  temperature,
  setTemperature,
  outlets,
  setOutlets,
}: FormBodyProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-(--text-secondary)">
        Tap one in each row. Helps someone else decide — takes 30 seconds.
      </p>

      <Question label="How loud is it right now?">
        <Pill icon="SpeakerSimpleLow" label="Quiet" active={noise === 'quiet'} onClick={() => setNoise('quiet')} />
        <Pill icon="SpeakerSimpleLow" label="Moderate" active={noise === 'moderate'} onClick={() => setNoise('moderate')} />
        <Pill icon="SpeakerSimpleHigh" label="Loud" active={noise === 'loud'} onClick={() => setNoise('loud')} />
      </Question>

      <Question label="Seats available?">
        <Pill icon="Armchair" label="Plenty" active={seating === 'plenty'} onClick={() => setSeating('plenty')} />
        <Pill icon="Armchair" label="Some" active={seating === 'some'} onClick={() => setSeating('some')} />
        <Pill icon="Armchair" label="Full" active={seating === 'full'} onClick={() => setSeating('full')} />
      </Question>

      <Question label="Temperature">
        <Pill icon="Thermometer" label="Cold" active={temperature === 'cold'} onClick={() => setTemperature('cold')} />
        <Pill icon="Thermometer" label="Comfy" active={temperature === 'comfortable'} onClick={() => setTemperature('comfortable')} />
        <Pill icon="Thermometer" label="Warm" active={temperature === 'warm'} onClick={() => setTemperature('warm')} />
        <Pill icon="Thermometer" label="Hot" active={temperature === 'hot'} onClick={() => setTemperature('hot')} />
      </Question>

      <Question label="Outlets">
        <Pill icon="Plug" label="Many" active={outlets === 'many'} onClick={() => setOutlets('many')} />
        <Pill icon="Plug" label="Some" active={outlets === 'some'} onClick={() => setOutlets('some')} />
        <Pill icon="Plug" label="None" active={outlets === 'none'} onClick={() => setOutlets('none')} />
      </Question>
    </div>
  );
}

function StepOptional({
  rotating,
  rotatingAnswer,
  setRotatingAnswer,
  wifiMbps,
  wifiLoading,
  onRunWifi,
  decibel,
  decibelLoading,
  onRunSound,
}: FormBodyProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-(--text-secondary)">
        All optional — skip and submit if you&apos;re in a hurry.
      </p>

      <div>
        <div className="text-[13px] font-semibold text-(--text-primary)">
          Quick measurements
        </div>
        <div className="mt-1 text-[11px] text-(--text-tertiary)">
          We process audio locally and never upload it.
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <MeasurementButton
            icon="WifiHigh"
            label="Wi-Fi"
            value={wifiMbps !== null ? `${wifiMbps} Mbps` : 'Run speed test'}
            loading={wifiLoading}
            onClick={onRunWifi}
          />
          <MeasurementButton
            icon="SpeakerSimpleLow"
            label="Noise"
            value={decibel !== null ? `${decibel} dB` : 'Sample 10 s'}
            loading={decibelLoading}
            onClick={onRunSound}
          />
        </div>
      </div>

      {rotating && (
        <div>
          <div className="text-[13px] font-semibold text-(--text-primary)">
            {rotating.prompt}
          </div>
          <div className="mt-1 text-[11px] text-(--text-tertiary)">
            Helps fill missing place info.
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {rotating.options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRotatingAnswer(rotatingAnswer === opt.value ? null : opt.value)}
                className={`rounded-full border px-3 py-2 text-[13px] font-medium transition ${
                  rotatingAnswer === opt.value
                    ? 'border-transparent bg-accent text-white'
                    : 'border-(--surface-border) bg-white text-(--text-primary) hover:bg-sys-gray-6'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MeasurementButton({
  icon,
  label,
  value,
  loading,
  onClick,
}: {
  icon: PhosphorIconName;
  label: string;
  value: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex flex-col items-start rounded-xl border border-(--surface-border) bg-white px-3 py-2 text-left transition hover:bg-sys-gray-6 disabled:opacity-60"
    >
      <Icon
        name={loading ? 'CircleNotch' : icon}
        size={18}
        className={loading ? 'animate-spin text-(--text-secondary)' : 'text-(--text-secondary)'}
      />
      <div className="mt-0.5 text-[11px] text-(--text-secondary)">{label}</div>
      <div className="text-[13px] font-semibold text-(--text-primary)">{value}</div>
    </button>
  );
}

function Question({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[13px] font-semibold text-(--text-primary)">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Pill({
  icon,
  label,
  active,
  onClick,
}: {
  icon: PhosphorIconName;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-[13px] font-medium transition ${
        active
          ? 'border-transparent bg-accent text-white'
          : 'border-(--surface-border) bg-white text-(--text-primary) hover:bg-sys-gray-6'
      }`}
    >
      <Icon name={icon} size={14} weight={active ? 'fill' : 'regular'} />
      <span>{label}</span>
    </button>
  );
}
