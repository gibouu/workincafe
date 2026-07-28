import { z } from 'zod'

// Versioned, structured opening-hours schema (Step 3B ruling 3). Hours are never
// free text and never live directly on `places`; the canonical current-hours
// record is `place_hours.schedule` (JSONB). `unknown` is distinct from `closed`,
// every day is explicit, and no "best guess" hours are ever synthesised from
// absence. Full validation lives here in Zod; the database enforces only stable
// structural checks (object, version = 1, required keys, size bound).

export const HOURS_SCHEMA_VERSION = 1 as const
export const HOURS_TIME_ZONE = 'America/Toronto' as const

export const DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const
export type DayKey = (typeof DAY_KEYS)[number]

// 24-hour HH:mm.
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'time must be 24-hour HH:mm')

const intervalSchema = z.object({
  opens: timeSchema,
  closes: timeSchema,
  // 0 = closes same day; 1 = closes after midnight (next day).
  closesDayOffset: z.union([z.literal(0), z.literal(1)]),
})
export type HoursInterval = z.infer<typeof intervalSchema>

const dayHoursSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('unknown') }),
  z.object({ state: z.literal('closed') }),
  z.object({ state: z.literal('open'), intervals: z.array(intervalSchema).min(1) }),
])
export type DayHours = z.infer<typeof dayHoursSchema>

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':')
  return Number(h) * 60 + Number(m)
}

/** [start, end) minute window for an interval, accounting for after-midnight close. */
function intervalWindow(iv: HoursInterval): { start: number; end: number } {
  return { start: toMinutes(iv.opens), end: toMinutes(iv.closes) + iv.closesDayOffset * 1440 }
}

const daysSchema = z.object({
  monday: dayHoursSchema,
  tuesday: dayHoursSchema,
  wednesday: dayHoursSchema,
  thursday: dayHoursSchema,
  friday: dayHoursSchema,
  saturday: dayHoursSchema,
  sunday: dayHoursSchema,
})

export const weeklyHoursV1Schema = z
  .object({
    version: z.literal(HOURS_SCHEMA_VERSION),
    timeZone: z.literal(HOURS_TIME_ZONE),
    days: daysSchema,
  })
  .superRefine((value, ctx) => {
    for (const day of DAY_KEYS) {
      const dayHours = value.days[day]
      if (dayHours.state !== 'open') continue
      const windows = dayHours.intervals.map(intervalWindow)
      // Each interval must be well-ordered (end strictly after start).
      windows.forEach((w, i) => {
        if (w.end <= w.start) {
          ctx.addIssue({
            code: 'custom',
            message: `${day} interval ${i} does not end after it starts`,
            path: ['days', day, 'intervals', i],
          })
        }
      })
      // Intervals must not overlap.
      const ordered = windows.map((w, i) => ({ ...w, i })).sort((a, b) => a.start - b.start)
      for (let k = 1; k < ordered.length; k++) {
        if (ordered[k].start < ordered[k - 1].end) {
          ctx.addIssue({
            code: 'custom',
            message: `${day} has overlapping intervals`,
            path: ['days', day, 'intervals', ordered[k].i],
          })
        }
      }
    }
  })

export type WeeklyHoursV1 = z.infer<typeof weeklyHoursV1Schema>

/** A fully-unknown week — the correct representation when hours are not known
 * (never fabricated as "closed" or as guessed open intervals). */
export function unknownWeeklyHours(): WeeklyHoursV1 {
  const days = Object.fromEntries(
    DAY_KEYS.map((d) => [d, { state: 'unknown' as const }]),
  ) as Record<DayKey, { state: 'unknown' }>
  return { version: HOURS_SCHEMA_VERSION, timeZone: HOURS_TIME_ZONE, days }
}
