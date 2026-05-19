'use client';

import { useMemo } from 'react';
import opening_hours from 'opening_hours';
import type { DemoPlace, NoiseBucket } from '@/lib/demo/paris-places';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// Reference week (Mon 2026-03-02 → Sun 2026-03-08) used to query
// opening_hours.js. We pick a non-holiday week so PH closures don't skew.
const REF_MONDAY = new Date(2026, 2, 2);

interface OpenWeek {
  // openByDay[day][hour] = true if the place is open at that hour.
  openByDay: boolean[][];
}

function emptyWeek(): boolean[][] {
  return Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => false));
}

function fallbackOpenWeek(): boolean[][] {
  // No OSM hours → assume 06:00–22:00 every day. The cells render green
  // until reviews / live updates supply real noise levels. The user
  // brief: "for now everybody will be green; in the future, green will
  // start becoming yellow and red as people post live updates."
  const out = emptyWeek();
  for (let d = 0; d < 7; d++) {
    for (let h = 6; h < 22; h++) out[d][h] = true;
  }
  return out;
}

function parseOpenWeek(raw: string | null | undefined): OpenWeek {
  if (!raw || !raw.trim()) return { openByDay: fallbackOpenWeek() };
  try {
    const oh = new opening_hours(raw);
    const weekStart = new Date(REF_MONDAY);
    weekStart.setHours(0, 0, 0, 0);
    const openByDay = emptyWeek();
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        // opening_hours.js indexes by JS Date; map ref week (Mon=0) to
        // JS getDay() (Sun=0).
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + d);
        date.setHours(h, 30, 0, 0); // probe mid-hour
        const jsDay = date.getDay();
        try {
          openByDay[jsDay][h] = oh.getState(date);
        } catch {
          // ignore single-cell parse failure; leave as closed
        }
      }
    }
    return { openByDay };
  } catch {
    return { openByDay: fallbackOpenWeek() };
  }
}

function scoreForCell(base: NoiseBucket, day: number, hour: number, isOpen: boolean): number | null {
  if (!isOpen) return null;
  if (base === 'unknown') return 1.5; // muted green default until reviews fill in
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
  if (score < 1.5) return '#34C759';
  if (score < 2.5) return '#8FD14F';
  if (score < 3.5) return '#FF9500';
  if (score < 4.5) return '#FF6B35';
  return '#FF3B30';
}

export function NoiseHeatmap({ place }: { place: DemoPlace }) {
  const { openByDay } = useMemo(() => parseOpenWeek(place.hours_raw ?? null), [place.hours_raw]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[13px] font-semibold text-(--text-primary)">
          Noise + open hours
        </div>
        <Legend />
      </div>
      <div className="overflow-x-auto">
        <div className="inline-block">
          <div className="flex">
            <div className="w-10 shrink-0" />
            <div className="grid gap-[2px]" style={{ gridTemplateColumns: 'repeat(24, 18px)' }}>
              {HOURS.map((h) => (
                <div key={h} className="text-center text-[9px] text-(--text-secondary)">
                  {h % 3 === 0 ? h : ''}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-1 flex flex-col gap-[2px]">
            {DAYS.map((day, d) => (
              <div key={day} className="flex items-center">
                <div className="w-10 shrink-0 text-[11px] text-(--text-secondary)">
                  {day}
                </div>
                <div className="grid gap-[2px]" style={{ gridTemplateColumns: 'repeat(24, 18px)' }}>
                  {HOURS.map((h) => {
                    const isOpen = openByDay[d]?.[h] ?? false;
                    const score = scoreForCell(place.noise, d, h, isOpen);
                    const bg = cellColor(score);
                    const tipState =
                      score === null
                        ? 'closed'
                        : score < 2.5
                          ? 'quiet'
                          : score < 3.5
                            ? 'moderate'
                            : 'loud';
                    return (
                      <div
                        key={h}
                        title={`${day} ${h}:00 · ${tipState}`}
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
    <div className="flex items-center gap-2 text-[10px] text-(--text-secondary)">
      <span>Quiet</span>
      <div className="flex gap-[2px]">
        <div className="h-3 w-3 rounded-xs" style={{ background: '#34C759' }} />
        <div className="h-3 w-3 rounded-xs" style={{ background: '#8FD14F' }} />
        <div className="h-3 w-3 rounded-xs" style={{ background: '#FF9500' }} />
        <div className="h-3 w-3 rounded-xs" style={{ background: '#FF6B35' }} />
        <div className="h-3 w-3 rounded-xs" style={{ background: '#FF3B30' }} />
      </div>
      <span>Loud</span>
    </div>
  );
}
