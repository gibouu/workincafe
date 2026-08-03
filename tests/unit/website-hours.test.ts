import { describe, expect, it } from 'vitest'
import { extractWebsiteHours } from '@/lib/domain/website-hours'

// Tier 1 coverage for the Decision 30 structured-data hours extractor: JSON-LD
// only, conservative shapes, never guesses from page text.

function page(jsonLd: unknown): string {
  return `<html><head><script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head><body><p>Open daily 6-11</p></body></html>`
}

describe('extractWebsiteHours', () => {
  it('parses an openingHoursSpecification array', () => {
    const { schedule, foundStructuredHours } = extractWebsiteHours(
      page({
        '@type': 'CafeOrCoffeeShop',
        openingHoursSpecification: [
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday'],
            opens: '08:00',
            closes: '17:00',
          },
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: 'Saturday',
            opens: '9:00',
            closes: '17:00:00',
          },
        ],
      }),
    )
    expect(foundStructuredHours).toBe(true)
    expect(schedule?.days.monday).toEqual({
      state: 'open',
      intervals: [{ opens: '08:00', closes: '17:00', closesDayOffset: 0 }],
    })
    expect(schedule?.days.saturday).toEqual({
      state: 'open',
      intervals: [{ opens: '09:00', closes: '17:00', closesDayOffset: 0 }],
    })
    // Unmentioned days prefill closed (operator reviews).
    expect(schedule?.days.sunday).toEqual({ state: 'closed' })
  })

  it('handles @graph nesting, schema.org day URLs, and midnight-crossing closes', () => {
    const { schedule } = extractWebsiteHours(
      page({
        '@graph': [
          {
            '@type': 'Restaurant',
            openingHoursSpecification: {
              dayOfWeek: 'https://schema.org/Friday',
              opens: '11:00',
              closes: '02:00',
            },
          },
        ],
      }),
    )
    expect(schedule?.days.friday).toEqual({
      state: 'open',
      intervals: [{ opens: '11:00', closes: '02:00', closesDayOffset: 1 }],
    })
  })

  it('treats opens = closes = 00:00 as an explicit closure', () => {
    const { schedule } = extractWebsiteHours(
      page({
        openingHoursSpecification: [
          { dayOfWeek: 'Monday', opens: '08:00', closes: '16:00' },
          { dayOfWeek: 'Sunday', opens: '00:00', closes: '00:00' },
        ],
      }),
    )
    expect(schedule?.days.sunday).toEqual({ state: 'closed' })
    expect(schedule?.days.monday.state).toBe('open')
  })

  it('falls back to openingHours strings (OSM grammar)', () => {
    const { schedule } = extractWebsiteHours(
      page({
        '@type': 'CafeOrCoffeeShop',
        openingHours: ['Mo-Fr 08:00-18:00', 'Sa-Su 09:00-17:00'],
      }),
    )
    expect(schedule?.days.wednesday).toEqual({
      state: 'open',
      intervals: [{ opens: '08:00', closes: '18:00', closesDayOffset: 0 }],
    })
    expect(schedule?.days.sunday.state).toBe('open')
  })

  it('rejects seasonal validity windows rather than merging them', () => {
    const { schedule, foundStructuredHours } = extractWebsiteHours(
      page({
        openingHoursSpecification: [
          {
            dayOfWeek: 'Monday',
            opens: '08:00',
            closes: '16:00',
            validFrom: '2026-06-01',
            validThrough: '2026-09-01',
          },
        ],
      }),
    )
    expect(foundStructuredHours).toBe(true)
    expect(schedule).toBeNull()
  })

  it('tolerates malformed JSON-LD blocks and finds hours in later ones', () => {
    const html =
      '<script type="application/ld+json">{not json</script>' +
      page({ openingHoursSpecification: { dayOfWeek: 'Monday', opens: '08:00', closes: '16:00' } })
    expect(extractWebsiteHours(html).schedule?.days.monday.state).toBe('open')
  })

  it('never extracts from page text', () => {
    const { schedule, foundStructuredHours } = extractWebsiteHours(
      '<html><body><h2>Hours</h2><p>Monday to Friday 8am - 6pm</p></body></html>',
    )
    expect(foundStructuredHours).toBe(false)
    expect(schedule).toBeNull()
  })
})
