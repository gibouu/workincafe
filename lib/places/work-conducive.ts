/**
 * Work-conducive filter — decides whether an OSM-sourced restaurant /
 * fast_food entry has hours that match a typical working day.
 *
 * Cafes, bakeries, libraries, coworking spaces, and hotel lobbies are kept
 * regardless of hours — their category already implies they're suited for
 * sitting and working. Only `restaurant` and `fast_food` are filtered, and
 * only when an `opening_hours` tag is present (OSM data is sparse — places
 * with no hours default to "include" so we don't lose good spots).
 *
 * Drop rules for restaurant / fast_food when hours ARE present:
 *   1. Every weekday's only opening interval starts ≥ 17:00 → dinner-only.
 *   2. Some weekday has more than one opening interval → split shift
 *      (e.g. classic French `12:00-15:00, 19:00-23:00`).
 *   3. No weekday has any single contiguous interval that opens before
 *      14:00 and runs at least 4 hours.
 *
 * Parser failures default to "include + log" so a buggy OSM tag never
 * silently deletes a place.
 *
 * @example  isWorkConducive('cafe', null) // → true (cafes always pass)
 * @example  isWorkConducive('restaurant', 'Mo-Su 19:00-02:00') // → false (dinner only)
 * @example  isWorkConducive('restaurant', 'Mo-Fr 12:00-15:00, 19:00-23:00') // → false (split)
 * @example  isWorkConducive('restaurant', 'Mo-Sa 11:00-23:00') // → true
 * @example  isWorkConducive('restaurant', '24/7') // → true
 * @example  isWorkConducive('restaurant', null) // → true (sparse OSM data)
 */

import opening_hours from 'opening_hours';

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const FOURTEEN_HUNDRED_MIN = 14 * 60;
const SEVENTEEN_HUNDRED_MIN = 17 * 60;

const WORK_HOURS_CATEGORIES = new Set(['restaurant', 'fast_food', 'fast_food_burger']);

// Anchor week: Mon 2026-03-02 → Fri 2026-03-06 inclusive. Choosing a
// non-holiday week so opening_hours.js doesn't return PH closures.
const WEEK_ANCHORS = [
  new Date('2026-03-02T00:00:00Z'), // Mon
  new Date('2026-03-03T00:00:00Z'),
  new Date('2026-03-04T00:00:00Z'),
  new Date('2026-03-05T00:00:00Z'),
  new Date('2026-03-06T00:00:00Z'), // Fri
];

interface OpenInterval {
  from: Date;
  to: Date;
}

export interface WorkConduciveOptions {
  /** Called when the parser throws — useful for tuning. Default: silent. */
  onParseError?: (raw: string, err: unknown) => void;
}

export function isWorkConducive(
  category: string,
  raw: string | null | undefined,
  opts: WorkConduciveOptions = {},
): boolean {
  if (!WORK_HOURS_CATEGORIES.has(category)) return true;
  if (!raw || raw.trim() === '') return true;

  let oh: opening_hours;
  try {
    oh = new opening_hours(raw);
  } catch (err) {
    opts.onParseError?.(raw, err);
    return true;
  }

  let anyDayQualifies = false;

  for (const dayStart of WEEK_ANCHORS) {
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCHours(24, 0, 0, 0);

    let intervals: [Date, Date, boolean | undefined, string | undefined][];
    try {
      intervals = oh.getOpenIntervals(dayStart, dayEnd);
    } catch (err) {
      opts.onParseError?.(raw, err);
      return true;
    }

    const open: OpenInterval[] = intervals.map(([from, to]) => ({ from, to }));
    if (open.length === 0) continue;
    if (open.length > 1) return false; // split shift on this weekday

    const single = open[0];
    const startMin = single.from.getUTCHours() * 60 + single.from.getUTCMinutes();
    const durationMs = single.to.getTime() - single.from.getTime();

    if (startMin < FOURTEEN_HUNDRED_MIN && durationMs >= FOUR_HOURS_MS) {
      anyDayQualifies = true;
    } else if (startMin >= SEVENTEEN_HUNDRED_MIN) {
      // Dinner-only this day. Don't flip anyDayQualifies, but don't reject
      // outright — Mon-Tue might be dinner-only while Wed-Fri is full day.
      continue;
    }
  }

  return anyDayQualifies;
}
