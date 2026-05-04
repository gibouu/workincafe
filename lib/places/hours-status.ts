/**
 * Compute "open now" status from an OSM `opening_hours` raw string.
 *
 * Returns:
 *   - { state: 'open',    rawLabel: 'Closes 18:00' }
 *   - { state: 'closed',  rawLabel: 'Opens 09:00 Mon' }
 *   - { state: 'unknown', rawLabel: 'Hours unknown' }  // missing or unparseable
 *
 * The label is meant to be rendered in the card hero strip; the state can
 * style it (green for open, gray for closed, muted for unknown).
 */

import opening_hours from 'opening_hours';

export type HoursState = 'open' | 'closed' | 'unknown';

export interface HoursStatus {
  state: HoursState;
  /** Short human label safe to show in the UI. */
  rawLabel: string;
  /** Source string we parsed (echoed for tooltips / debugging). */
  raw?: string;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fmtTime(d: Date): string {
  // Use local time of the place. We don't have per-place tz so we fall back
  // to the user's local timezone — fine for "is this open right now" UX.
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function hoursStatus(raw: string | null | undefined, now: Date = new Date()): HoursStatus {
  if (!raw || !raw.trim()) {
    return { state: 'unknown', rawLabel: 'Hours unknown' };
  }
  try {
    const oh = new opening_hours(raw);
    const isOpen = oh.getState(now);
    const next = oh.getNextChange(now);

    if (isOpen) {
      if (!next) return { state: 'open', rawLabel: 'Open 24/7', raw };
      const sameDay = next.getDate() === now.getDate() && next.getMonth() === now.getMonth();
      const label = sameDay ? `Closes ${fmtTime(next)}` : `Open · closes later`;
      return { state: 'open', rawLabel: label, raw };
    }

    if (!next) return { state: 'closed', rawLabel: 'Closed', raw };
    const sameDay = next.getDate() === now.getDate() && next.getMonth() === now.getMonth();
    const label = sameDay
      ? `Closed · opens ${fmtTime(next)}`
      : `Closed · opens ${DAY_NAMES[next.getDay()]} ${fmtTime(next)}`;
    return { state: 'closed', rawLabel: label, raw };
  } catch {
    return { state: 'unknown', rawLabel: 'Hours unknown', raw };
  }
}
