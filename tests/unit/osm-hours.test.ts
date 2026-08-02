import { describe, expect, it } from 'vitest'
import { parseOsmOpeningHours } from '@/lib/domain/osm-hours'

// Tier 1 coverage for the Decision 29 conservative opening_hours subset
// parser. The contract: parse the common shapes exactly, return null for
// anything outside the subset (never guess), and map unmentioned days to
// `closed` per the opening_hours specification (operator-reviewed prefill).

describe('parseOsmOpeningHours', () => {
  it('parses 24/7 as open all week across midnight', () => {
    const parsed = parseOsmOpeningHours('24/7')
    expect(parsed).not.toBeNull()
    expect(parsed?.days.monday).toEqual({
      state: 'open',
      intervals: [{ opens: '00:00', closes: '00:00', closesDayOffset: 1 }],
    })
    expect(parsed?.days.sunday.state).toBe('open')
  })

  it('parses a single all-week rule', () => {
    const parsed = parseOsmOpeningHours('Mo-Su 07:00-20:00')
    expect(parsed?.days.wednesday).toEqual({
      state: 'open',
      intervals: [{ opens: '07:00', closes: '20:00', closesDayOffset: 0 }],
    })
  })

  it('parses semicolon-separated rules and maps unmentioned days to closed', () => {
    const parsed = parseOsmOpeningHours('Mo-Fr 06:00-20:00; Sa 07:00-20:00')
    expect(parsed?.days.friday).toEqual({
      state: 'open',
      intervals: [{ opens: '06:00', closes: '20:00', closesDayOffset: 0 }],
    })
    expect(parsed?.days.saturday).toEqual({
      state: 'open',
      intervals: [{ opens: '07:00', closes: '20:00', closesDayOffset: 0 }],
    })
    expect(parsed?.days.sunday).toEqual({ state: 'closed' })
  })

  it('parses day lists and explicit off', () => {
    const parsed = parseOsmOpeningHours('Mo-Fr 08:30-16:00; Sa,Su off')
    expect(parsed?.days.saturday).toEqual({ state: 'closed' })
    expect(parsed?.days.sunday).toEqual({ state: 'closed' })
    expect(parsed?.days.monday.state).toBe('open')
  })

  it('parses comma-separated rule sequences (real Toronto value)', () => {
    const parsed = parseOsmOpeningHours(
      'Mo-We 13:00-23:00, Th 13:00-24:00, Fr-Sa 11:00-02:00, Su 11:00-23:00',
    )
    expect(parsed?.days.tuesday).toEqual({
      state: 'open',
      intervals: [{ opens: '13:00', closes: '23:00', closesDayOffset: 0 }],
    })
    // 24:00 closes → 00:00 next day.
    expect(parsed?.days.thursday).toEqual({
      state: 'open',
      intervals: [{ opens: '13:00', closes: '00:00', closesDayOffset: 1 }],
    })
    // Past-midnight closes.
    expect(parsed?.days.friday).toEqual({
      state: 'open',
      intervals: [{ opens: '11:00', closes: '02:00', closesDayOffset: 1 }],
    })
    expect(parsed?.days.sunday).toEqual({
      state: 'open',
      intervals: [{ opens: '11:00', closes: '23:00', closesDayOffset: 0 }],
    })
  })

  it('parses split-service interval lists', () => {
    const parsed = parseOsmOpeningHours('Mo-Fr 08:00-11:30,13:00-17:00')
    expect(parsed?.days.monday).toEqual({
      state: 'open',
      intervals: [
        { opens: '08:00', closes: '11:30', closesDayOffset: 0 },
        { opens: '13:00', closes: '17:00', closesDayOffset: 0 },
      ],
    })
  })

  it('parses wrapping day ranges', () => {
    const parsed = parseOsmOpeningHours('Fr-Mo 10:00-18:00')
    expect(parsed?.days.friday.state).toBe('open')
    expect(parsed?.days.saturday.state).toBe('open')
    expect(parsed?.days.sunday.state).toBe('open')
    expect(parsed?.days.monday.state).toBe('open')
    expect(parsed?.days.tuesday).toEqual({ state: 'closed' })
  })

  it('lets a later rule override an earlier one for the same day', () => {
    const parsed = parseOsmOpeningHours('Mo-Su 08:00-20:00; Su 10:00-16:00')
    expect(parsed?.days.sunday).toEqual({
      state: 'open',
      intervals: [{ opens: '10:00', closes: '16:00', closesDayOffset: 0 }],
    })
    expect(parsed?.days.saturday).toEqual({
      state: 'open',
      intervals: [{ opens: '08:00', closes: '20:00', closesDayOffset: 0 }],
    })
  })

  it('ignores public-holiday rules', () => {
    const parsed = parseOsmOpeningHours('Mo-Fr 08:00-18:00; PH off')
    expect(parsed?.days.monday.state).toBe('open')
    const mixed = parseOsmOpeningHours('Mo-Fr 08:00-18:00; Su,PH off')
    expect(mixed?.days.sunday).toEqual({ state: 'closed' })
  })

  it('tolerates surrounding whitespace', () => {
    expect(parseOsmOpeningHours('  Mo-Fr  08:00-18:00 ;  Sa off ')).not.toBeNull()
  })

  it('returns null for anything outside the subset (never guesses)', () => {
    for (const value of [
      '',
      'Mo-Fr sunrise-sunset',
      'Mo-Fr 08:00+',
      'Jan-Mar Mo-Fr 08:00-18:00',
      'Mo-Fr 08:00-18:00 "by appointment"',
      'week 1-26 Mo 08:00-18:00',
      'Mo-Fr 8:00-18:00',
      'Mo-Fr 08:00-25:00',
      'Mo-Fr 08:60-18:00',
      'appointment only',
    ]) {
      expect(parseOsmOpeningHours(value), value).toBeNull()
    }
  })

  it('returns null when intervals overlap (domain schema is the final word)', () => {
    expect(parseOsmOpeningHours('Mo 08:00-14:00,12:00-18:00')).toBeNull()
  })
})
