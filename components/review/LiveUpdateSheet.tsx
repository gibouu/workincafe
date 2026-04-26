'use client';

import { useState } from 'react';
import { Drawer } from 'vaul';
import { Icon, type PhosphorIconName } from '@/components/icons/Icon';
import type { DemoPlace } from '@/lib/demo/paris-places';
import { categoryMeta } from '@/lib/categories';
import { useToasts } from '@/lib/store/toasts';
import { savePending, buildAuthRedirect } from '@/lib/auth/pending-submit';
import { runSpeedtest } from '@/lib/measurement/speedtest';
import { runDecibelTest } from '@/lib/measurement/decibel';

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

export function LiveUpdateSheet({
  place,
  open,
  onOpenChange,
}: {
  place: DemoPlace | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [noise, setNoise] = useState<Noise | null>(null);
  const [seating, setSeating] = useState<Seating | null>(null);
  const [temperature, setTemperature] = useState<Temperature | null>(null);
  const [outlets, setOutlets] = useState<Outlets | null>(null);
  const [rotatingAnswer, setRotatingAnswer] = useState<string | null>(null);
  const [wifiMbps, setWifiMbps] = useState<number | null>(null);
  const [wifiLoading, setWifiLoading] = useState(false);
  const [decibel, setDecibel] = useState<number | null>(null);
  const [decibelLoading, setDecibelLoading] = useState(false);
  const showToast = useToasts((s) => s.show);
  const rotating = place ? pickRotatingQuestion(place.id) : null;

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
    setNoise(null);
    setSeating(null);
    setTemperature(null);
    setOutlets(null);
    setRotatingAnswer(null);
    setWifiMbps(null);
    setDecibel(null);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const canSubmit = noise !== null && seating !== null && temperature !== null && outlets !== null;
  const onSubmit = async () => {
    if (!canSubmit || !place) return;
    const body = {
      place_id: place.id,
      noise_level: noise,
      seating_availability: seating,
      temperature,
      outlets,
      ...(wifiMbps !== null ? { wifi_mbps: wifiMbps } : {}),
      ...(decibel !== null ? { decibel_db: decibel } : {}),
      ...(rotating && rotatingAnswer
        ? { rotating_question: rotating.key, rotating_answer: rotatingAnswer }
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
        const nextPath = typeof window !== 'undefined'
          ? window.location.pathname + window.location.search
          : '/';
        window.location.assign(buildAuthRedirect(nextPath, 'live-update'));
        return;
      }
      // Treat 404/503 (table missing) the same as success in the demo.
      showToast(`Update shared for ${place.name}`);
      handleClose(false);
    } catch {
      showToast('Could not share update', { tone: 'error' });
    }
  };

  return (
    <Drawer.Root open={open} onOpenChange={handleClose}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/20 z-40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex h-[88dvh] max-w-md flex-col rounded-t-3xl bg-white shadow-float outline-none">
          <Drawer.Title className="sr-only">Live review</Drawer.Title>
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-sys-gray-4" />

          {place ? (
            <FormBody
              place={place}
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
              canSubmit={canSubmit}
              onSubmit={onSubmit}
              onClose={() => handleClose(false)}
            />
          ) : null}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function FormBody({
  place,
  noise,
  setNoise,
  seating,
  setSeating,
  temperature,
  setTemperature,
  outlets,
  setOutlets,
  rotating,
  rotatingAnswer,
  setRotatingAnswer,
  wifiMbps,
  wifiLoading,
  onRunWifi,
  decibel,
  decibelLoading,
  onRunSound,
  canSubmit,
  onSubmit,
  onClose,
}: {
  place: DemoPlace;
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
  canSubmit: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const meta = categoryMeta(place.category);
  return (
    <>
      <div className="flex items-start justify-between gap-3 px-5 pt-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-white shadow-bubble"
            style={{ background: meta.color }}
          >
            <Icon name={meta.icon} size={18} />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
              Live review
            </div>
            <div className="text-[17px] font-semibold text-[var(--text-primary)]">{place.name}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-sys-gray-6 text-[var(--text-secondary)]"
        >
          <Icon name="X" size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <p className="text-[13px] text-[var(--text-secondary)]">
          Help someone else decide — takes 30 seconds.
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

        <div className="mt-5 grid grid-cols-2 gap-2">
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
        <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
          Optional. We process audio locally and never upload it.
        </p>

        {rotating && (
          <div className="mt-5 rounded-2xl border border-dashed border-[var(--surface-border)] p-3">
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-semibold text-[var(--text-primary)]">
                {rotating.prompt}
              </div>
              <span className="rounded-full bg-sys-gray-6 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                Optional
              </span>
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
              Helps fill missing place info. Skip if you&apos;re not sure.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {rotating.options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setRotatingAnswer(rotatingAnswer === opt.value ? null : opt.value)
                  }
                  className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${
                    rotatingAnswer === opt.value
                      ? 'border-transparent bg-accent text-white'
                      : 'border-[var(--surface-border)] bg-white text-[var(--text-primary)] hover:bg-sys-gray-6'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-[var(--surface-border)] p-4">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={onSubmit}
          className="w-full rounded-2xl bg-accent py-3.5 text-[15px] font-semibold text-white hover:opacity-90 disabled:bg-sys-gray-4 disabled:cursor-not-allowed transition"
        >
          Submit update
        </button>
      </div>
    </>
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
      className="flex flex-col items-start rounded-xl border border-[var(--surface-border)] bg-white px-3 py-2 text-left transition hover:bg-sys-gray-6 disabled:opacity-60"
    >
      <Icon
        name={loading ? 'CircleNotch' : icon}
        size={18}
        className={loading ? 'animate-spin text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}
      />
      <div className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{label}</div>
      <div className="text-[13px] font-semibold text-[var(--text-primary)]">{value}</div>
    </button>
  );
}

function Question({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 first:mt-4">
      <div className="mb-2 text-[13px] font-semibold text-[var(--text-primary)]">{label}</div>
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
          : 'border-[var(--surface-border)] bg-white text-[var(--text-primary)] hover:bg-sys-gray-6'
      }`}
    >
      <Icon name={icon} size={14} weight={active ? 'fill' : 'regular'} />
      <span>{label}</span>
    </button>
  );
}
