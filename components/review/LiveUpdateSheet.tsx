'use client';

import { useState } from 'react';
import { Drawer } from 'vaul';
import { Icon, type PhosphorIconName } from '@/components/icons/Icon';
import type { DemoPlace } from '@/lib/demo/paris-places';
import { categoryMeta } from '@/lib/categories';
import { useToasts } from '@/lib/store/toasts';

type Noise = 'quiet' | 'moderate' | 'loud';
type Seating = 'plenty' | 'some' | 'full';
type Temperature = 'cold' | 'comfortable' | 'warm' | 'hot';
type Outlets = 'many' | 'some' | 'none';

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
  const showToast = useToasts((s) => s.show);

  const reset = () => {
    setNoise(null);
    setSeating(null);
    setTemperature(null);
    setOutlets(null);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const canSubmit = noise !== null && seating !== null && temperature !== null && outlets !== null;
  const onSubmit = () => {
    if (!canSubmit || !place) return;
    const body = {
      place_id: place.id,
      noise_level: noise,
      seating_availability: seating,
      temperature,
    };
    void fetch('/api/live-updates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);
    showToast(`Update shared for ${place.name}`);
    handleClose(false);
  };

  return (
    <Drawer.Root open={open} onOpenChange={handleClose} snapPoints={[0.7, 0.95]}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/20 z-40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md rounded-t-3xl bg-white shadow-float outline-none flex flex-col max-h-[95vh]">
          <Drawer.Title className="sr-only">Quick update</Drawer.Title>
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
              Quick update
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
