'use client';

import type { DemoPlace, NoiseBucket } from '@/lib/demo/paris-places';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function scoreForCell(base: NoiseBucket, day: number, hour: number): number | null {
  // Synthetic: quiet at night, peaks around breakfast, lunch, dinner.
  // Empty cells before 6am and after 10pm to suggest closed hours.
  if (hour < 6 || hour > 22) return null;

  const baseOffset = base === 'quiet' ? -1 : base === 'loud' ? 1 : 0;
  const isWeekend = day === 0 || day === 6;

  const breakfastPeak = hour >= 8 && hour <= 10 ? 1.3 : 0;
  const lunchPeak = hour >= 12 && hour <= 14 ? 1.8 : 0;
  const dinnerPeak = hour >= 18 && hour <= 20 ? 1.5 : 0;
  const afternoonLull = hour >= 15 && hour <= 17 ? -0.5 : 0;

  const score = 1.5 + baseOffset + breakfastPeak + lunchPeak + dinnerPeak + afternoonLull + (isWeekend ? 0.4 : 0);
  return Math.max(0, Math.min(5, score));
}

function cellColor(score: number | null): string {
  if (score === null) return 'repeating-linear-gradient(45deg, #F2F2F7 0 3px, transparent 3px 6px)';
  if (score < 1.5) return '#34C759'; // green - quiet
  if (score < 2.5) return '#8FD14F';
  if (score < 3.5) return '#FF9500'; // amber - moderate
  if (score < 4.5) return '#FF6B35';
  return '#FF3B30'; // red - loud
}

export function NoiseHeatmap({ place }: { place: DemoPlace }) {
  // Until reviews populate the materialized view, the heatmap has no real
  // signal — synthetic colors lie about reality. Show an empty state.
  if (place.noise === 'unknown') {
    return (
      <div className="rounded-xl bg-sys-gray-6 px-4 py-5 text-center text-[12px] text-[var(--text-secondary)]">
        No noise readings yet. Live updates from the next visitors will fill this in.
      </div>
    );
  }
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[13px] font-semibold text-[var(--text-primary)]">
          Noise by time of day
        </div>
        <Legend />
      </div>
      <div className="overflow-x-auto">
        <div className="inline-block">
          <div className="flex">
            <div className="w-10 shrink-0" />
            <div className="grid gap-[2px]" style={{ gridTemplateColumns: 'repeat(24, 18px)' }}>
              {HOURS.map((h) => (
                <div key={h} className="text-center text-[9px] text-[var(--text-secondary)]">
                  {h % 3 === 0 ? h : ''}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-1 flex flex-col gap-[2px]">
            {DAYS.map((day, d) => (
              <div key={day} className="flex items-center">
                <div className="w-10 shrink-0 text-[11px] text-[var(--text-secondary)]">
                  {day}
                </div>
                <div className="grid gap-[2px]" style={{ gridTemplateColumns: 'repeat(24, 18px)' }}>
                  {HOURS.map((h) => {
                    const score = scoreForCell(place.noise, d, h);
                    const bg = cellColor(score);
                    return (
                      <div
                        key={h}
                        title={`${day} ${h}:00 · ${score === null ? 'closed' : score < 2.5 ? 'quiet' : score < 3.5 ? 'moderate' : 'loud'}`}
                        className="h-[18px] w-[18px] rounded-[3px]"
                        style={{ background: bg }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)]">
      <span>Quiet</span>
      <div className="flex gap-[2px]">
        <div className="h-3 w-3 rounded-sm" style={{ background: '#34C759' }} />
        <div className="h-3 w-3 rounded-sm" style={{ background: '#8FD14F' }} />
        <div className="h-3 w-3 rounded-sm" style={{ background: '#FF9500' }} />
        <div className="h-3 w-3 rounded-sm" style={{ background: '#FF6B35' }} />
        <div className="h-3 w-3 rounded-sm" style={{ background: '#FF3B30' }} />
      </div>
      <span>Loud</span>
    </div>
  );
}
