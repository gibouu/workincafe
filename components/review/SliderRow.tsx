'use client';

import { useId } from 'react';
import { Icon, type PhosphorIconName } from '@/components/icons/Icon';

export interface SliderAnchor {
  at: number;
  text: string;
}

export interface SliderRowProps {
  icon: PhosphorIconName;
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  anchors: SliderAnchor[];
  endLabels?: { low: string; high: string };
  hint?: string;
}

function activeAnchor(anchors: SliderAnchor[], value: number): SliderAnchor | null {
  if (anchors.length === 0) return null;
  const sorted = [...anchors].sort((a, b) => a.at - b.at);
  let active = sorted[0];
  for (const a of sorted) {
    if (a.at <= value) active = a;
  }
  return active;
}

export function SliderRow({
  icon,
  label,
  value,
  min = 1,
  max = 10,
  step = 1,
  onChange,
  anchors,
  endLabels,
  hint,
}: SliderRowProps) {
  const id = useId();
  const touched = value > 0;
  const displayValue = touched ? value : min;
  const pct = ((displayValue - min) / (max - min)) * 100;
  const anchor = activeAnchor(anchors, displayValue);
  const ticks = max - min + 1;
  const trackStyle: React.CSSProperties = {
    background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, var(--sys-gray-5, #E5E5EA) ${pct}%, var(--sys-gray-5, #E5E5EA) 100%)`,
  };

  return (
    <div className="py-3">
      <div className="flex items-center gap-2">
        <Icon name={icon} size={18} className="text-[var(--text-secondary)]" />
        <label htmlFor={id} className="text-[13px] font-medium text-[var(--text-primary)]">
          {label}
        </label>
        <div className="ml-auto text-[11px] tabular-nums text-[var(--text-secondary)]">
          {touched ? `${value} / ${max}` : '—'}
        </div>
      </div>

      <div
        className={`mt-2 min-h-[18px] text-[12px] font-semibold transition-opacity ${
          touched ? 'text-[var(--text-primary)] opacity-100' : 'text-[var(--text-tertiary)] opacity-70'
        }`}
        aria-live="polite"
        key={anchor?.at ?? -1}
      >
        {anchor?.text ?? (endLabels?.low ?? 'Drag to rate')}
      </div>

      <div className="relative mt-2">
        <div className="absolute inset-x-1 -top-1 flex justify-between" aria-hidden>
          {Array.from({ length: ticks }).map((_, i) => (
            <span
              key={i}
              className="h-1 w-1 rounded-full bg-[var(--sys-gray-4,#D1D1D6)]"
            />
          ))}
        </div>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={displayValue}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-valuetext={anchor?.text ?? `${displayValue}`}
          className="wic-slider relative z-10 h-6 w-full cursor-pointer appearance-none bg-transparent focus:outline-none"
          style={trackStyle}
        />
      </div>

      {endLabels && (
        <div className="mt-1 flex justify-between text-[10px] text-[var(--text-tertiary)]">
          <span>{endLabels.low}</span>
          <span>{endLabels.high}</span>
        </div>
      )}

      {hint && (
        <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">{hint}</p>
      )}
    </div>
  );
}
