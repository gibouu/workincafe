'use client';

import { Drawer } from 'vaul';
import { Icon, type PhosphorIconName } from '@/components/icons/Icon';
import { CATEGORIES, type PlaceCategory } from '@/lib/categories';
import {
  useFilters,
  type NoiseFilter,
  type WifiFilter,
  type SeatsFilter,
  type RatingFilter,
} from '@/lib/store/filters';

export function FilterSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const f = useFilters();

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/20 z-40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex h-[88dvh] max-w-md flex-col rounded-t-3xl bg-white shadow-float outline-none">
          <Drawer.Title className="sr-only">Filters</Drawer.Title>
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-sys-gray-4" />

          <div className="flex items-center justify-between px-5 pt-3">
            <div className="text-[17px] font-semibold text-[var(--text-primary)]">Filters</div>
            <button
              type="button"
              onClick={() => f.reset()}
              className="text-[13px] font-medium text-accent"
            >
              Reset
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-6 pt-3">
            <Section title="Business type">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(CATEGORIES) as PlaceCategory[])
                  .filter((c) => c !== 'other' && c !== 'fast_food')
                  .map((c) => (
                    <CategoryChip
                      key={c}
                      category={c}
                      active={f.categories.has(c)}
                      onClick={() => f.toggleCategory(c)}
                    />
                  ))}
              </div>
            </Section>

            <Section title="Essentials">
              <div className="flex flex-col gap-2">
                <Toggle
                  icon="Clock"
                  label="Open now"
                  value={f.openNow}
                  onChange={f.setOpenNow}
                />
                <Toggle
                  icon="Plug"
                  label="Power outlets"
                  value={f.outlets}
                  onChange={f.setOutlets}
                />
                <Toggle
                  icon="Tree"
                  label="Outdoor seating"
                  value={f.outdoor}
                  onChange={f.setOutdoor}
                />
                <Toggle
                  icon="SpeakerSimpleLow"
                  label="Quiet right now"
                  value={f.quietNow}
                  onChange={f.setQuietNow}
                />
              </div>
            </Section>

            <Section title="Noise">
              <SegmentedControl<NoiseFilter>
                options={[
                  { value: 'quiet', label: 'Quiet' },
                  { value: 'moderate', label: 'Moderate' },
                  { value: 'loud', label: 'Loud' },
                  { value: 'any', label: 'Any' },
                ]}
                value={f.noise}
                onChange={f.setNoise}
              />
            </Section>

            <Section title="Wi-Fi">
              <SegmentedControl<WifiFilter>
                options={[
                  { value: 'slow', label: 'Slow' },
                  { value: 'moderate', label: 'OK' },
                  { value: 'fast', label: 'Fast' },
                  { value: 'any', label: 'Any' },
                ]}
                value={f.wifi}
                onChange={f.setWifi}
              />
            </Section>

            <Section title="Seating">
              <SegmentedControl<SeatsFilter>
                options={[
                  { value: 'plenty', label: 'Plenty' },
                  { value: 'some', label: 'Some' },
                  { value: 'any', label: 'Any' },
                ]}
                value={f.seats}
                onChange={f.setSeats}
              />
            </Section>

            <Section title="Rating">
              <SegmentedControl<string>
                options={[
                  { value: '3.5', label: '≥3.5' },
                  { value: '4.0', label: '≥4.0' },
                  { value: '4.5', label: '≥4.5' },
                  { value: 'any', label: 'Any' },
                ]}
                value={f.minRating === null ? 'any' : String(f.minRating.toFixed(1))}
                onChange={(v) =>
                  f.setMinRating(
                    v === 'any' ? null : (parseFloat(v) as Exclude<RatingFilter, null>),
                  )
                }
              />
            </Section>

            <Section title={`Distance: ${f.maxDistanceKm.toFixed(1)} km`}>
              <input
                type="range"
                min={0.1}
                max={20}
                step={0.1}
                value={f.maxDistanceKm}
                onChange={(e) => f.setMaxDistanceKm(parseFloat(e.target.value))}
                className="w-full accent-accent"
              />
            </Section>
          </div>

          <div className="border-t border-[var(--surface-border)] p-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-full rounded-2xl bg-accent py-3.5 text-[15px] font-semibold text-white hover:opacity-90 transition"
            >
              Apply filters
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 first:mt-0">
      <div className="mb-2 text-[13px] font-semibold text-[var(--text-primary)]">{title}</div>
      {children}
    </div>
  );
}

function CategoryChip({
  category,
  active,
  onClick,
}: {
  category: PlaceCategory;
  active: boolean;
  onClick: () => void;
}) {
  const meta = CATEGORIES[category];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition ${
        active
          ? 'border-transparent text-white'
          : 'border-[var(--surface-border)] bg-white text-[var(--text-primary)] hover:bg-sys-gray-6'
      }`}
      style={active ? { background: meta.color } : undefined}
    >
      <Icon name={meta.icon} size={14} weight={active ? 'fill' : 'regular'} />
      <span>{meta.label}</span>
    </button>
  );
}

function Toggle({
  icon,
  label,
  value,
  onChange,
}: {
  icon: PhosphorIconName;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center justify-between rounded-2xl border border-[var(--surface-border)] bg-white px-4 py-3 hover:bg-sys-gray-6 transition"
    >
      <div className="flex items-center gap-3">
        <Icon name={icon} size={18} className="text-[var(--text-secondary)]" />
        <span className="text-[14px] text-[var(--text-primary)]">{label}</span>
      </div>
      <div
        className={`flex h-6 w-10 items-center rounded-full transition ${
          value ? 'bg-accent-green' : 'bg-sys-gray-4'
        }`}
      >
        <div
          className={`h-5 w-5 rounded-full bg-white shadow transition ${
            value ? 'translate-x-[18px]' : 'translate-x-[2px]'
          }`}
        />
      </div>
    </button>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-xl bg-sys-gray-6 p-1">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 rounded-lg py-2 text-[13px] font-medium transition ${
              active
                ? 'bg-white text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
