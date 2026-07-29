import { describe, expect, it } from 'vitest'
import { unknownWeeklyHours } from '@/lib/domain/hours'
import { setCafeHoursInputSchema } from '@/lib/domain/hours-input'

// Tier 1 coverage for the operator hours-input contract. Deep schedule rules
// (interval ordering, overlap, unknown ≠ closed) are covered by
// tests/unit/hours.test.ts; here we cover the composed operator input.

const PLACE_ID = '7d9a1f9c-9f3a-4b6e-8c5d-2f1e3a4b5c6d'

function openMonday() {
  const schedule = unknownWeeklyHours()
  return {
    ...schedule,
    days: {
      ...schedule.days,
      monday: {
        state: 'open' as const,
        intervals: [{ opens: '08:00', closes: '17:00', closesDayOffset: 0 as const }],
      },
    },
  }
}

describe('setCafeHoursInputSchema', () => {
  it('accepts a fully-unknown week (hours never fabricated from absence)', () => {
    const res = setCafeHoursInputSchema.safeParse({
      placeId: PLACE_ID,
      confidence: 'medium',
      schedule: unknownWeeklyHours(),
    })
    expect(res.success).toBe(true)
  })

  it('accepts a schedule with open intervals', () => {
    const res = setCafeHoursInputSchema.safeParse({
      placeId: PLACE_ID,
      confidence: 'high',
      schedule: openMonday(),
    })
    expect(res.success).toBe(true)
  })

  it('rejects an invalid schedule (open day with overlapping intervals)', () => {
    const schedule = openMonday()
    schedule.days.monday.intervals.push({ opens: '16:00', closes: '18:00', closesDayOffset: 0 })
    const res = setCafeHoursInputSchema.safeParse({
      placeId: PLACE_ID,
      confidence: 'medium',
      schedule,
    })
    expect(res.success).toBe(false)
  })

  it('rejects a malformed place id and an invalid confidence', () => {
    const schedule = unknownWeeklyHours()
    expect(
      setCafeHoursInputSchema.safeParse({ placeId: 'nope', confidence: 'medium', schedule })
        .success,
    ).toBe(false)
    expect(
      setCafeHoursInputSchema.safeParse({ placeId: PLACE_ID, confidence: 'certain', schedule })
        .success,
    ).toBe(false)
  })
})
