import { describe, expect, it } from 'vitest'
import {
  HOURS_TIME_ZONE,
  unknownWeeklyHours,
  weeklyHoursV1Schema,
  type WeeklyHoursV1,
} from '@/lib/domain/hours'

function week(overrides: Partial<WeeklyHoursV1['days']>): unknown {
  const base = unknownWeeklyHours()
  return { ...base, days: { ...base.days, ...overrides } }
}

describe('WeeklyHoursV1 validation', () => {
  it('#21 distinguishes unknown, closed and open days', () => {
    const parsed = weeklyHoursV1Schema.parse(
      week({
        monday: {
          state: 'open',
          intervals: [{ opens: '08:00', closes: '22:00', closesDayOffset: 0 }],
        },
        tuesday: { state: 'closed' },
        wednesday: { state: 'unknown' },
      }),
    )
    expect(parsed.days.monday.state).toBe('open')
    expect(parsed.days.tuesday.state).toBe('closed')
    expect(parsed.days.wednesday.state).toBe('unknown')
    // A fully-unknown week is valid and is never fabricated as closed/open.
    expect(weeklyHoursV1Schema.safeParse(unknownWeeklyHours()).success).toBe(true)
  })

  it('accepts an after-midnight close via closesDayOffset', () => {
    const ok = week({
      friday: {
        state: 'open',
        intervals: [{ opens: '20:00', closes: '02:00', closesDayOffset: 1 }],
      },
    })
    expect(weeklyHoursV1Schema.safeParse(ok).success).toBe(true)
  })

  it('#22 rejects overlapping intervals', () => {
    const bad = week({
      monday: {
        state: 'open',
        intervals: [
          { opens: '08:00', closes: '12:00', closesDayOffset: 0 },
          { opens: '11:30', closes: '15:00', closesDayOffset: 0 },
        ],
      },
    })
    expect(weeklyHoursV1Schema.safeParse(bad).success).toBe(false)
  })

  it('#22 rejects an interval that does not end after it starts', () => {
    const bad = week({
      monday: {
        state: 'open',
        intervals: [{ opens: '12:00', closes: '09:00', closesDayOffset: 0 }],
      },
    })
    expect(weeklyHoursV1Schema.safeParse(bad).success).toBe(false)
  })

  it('#22 rejects malformed times, wrong version, wrong time zone and missing days', () => {
    expect(
      weeklyHoursV1Schema.safeParse(
        week({
          monday: {
            state: 'open',
            intervals: [{ opens: '8:00', closes: '22:00', closesDayOffset: 0 }],
          },
        }),
      ).success,
    ).toBe(false)
    expect(
      weeklyHoursV1Schema.safeParse(
        week({
          monday: {
            state: 'open',
            intervals: [{ opens: '08:00', closes: '25:00', closesDayOffset: 0 }],
          },
        }),
      ).success,
    ).toBe(false)
    expect(weeklyHoursV1Schema.safeParse({ ...unknownWeeklyHours(), version: 2 }).success).toBe(
      false,
    )
    expect(
      weeklyHoursV1Schema.safeParse({ ...unknownWeeklyHours(), timeZone: 'UTC' }).success,
    ).toBe(false)
    const { days } = unknownWeeklyHours()
    const missing = { version: 1, timeZone: HOURS_TIME_ZONE, days: { ...days, sunday: undefined } }
    expect(weeklyHoursV1Schema.safeParse(missing).success).toBe(false)
  })
})
