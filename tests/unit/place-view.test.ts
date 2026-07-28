import { describe, expect, it } from 'vitest'
import { ATTRIBUTE_KINDS } from '@/lib/domain/attributes'
import {
  buildAttributeDetails,
  buildAttributes,
  emptyAttributeDetails,
  emptyAttributes,
} from '@/lib/domain/place-view'

describe('place-view builders', () => {
  it('emptyAttributes defaults every kind to unknown (absence is never negative)', () => {
    const attrs = emptyAttributes()
    for (const kind of ATTRIBUTE_KINDS) expect(attrs[kind]).toBe('unknown')
  })

  it('buildAttributes fills provided kinds and leaves the rest unknown', () => {
    const attrs = buildAttributes([
      { kind: 'wifi', value: 'fast' },
      { kind: 'noise', value: 'quiet' },
    ])
    expect(attrs.wifi).toBe('fast')
    expect(attrs.noise).toBe('quiet')
    expect(attrs.power).toBe('unknown')
    expect(attrs.seating).toBe('unknown')
  })

  it('buildAttributeDetails carries provenance/confidence/date and defaults the rest', () => {
    const details = buildAttributeDetails([
      {
        kind: 'wifi',
        value: 'usable',
        provenance: 'curator',
        confidence: 'medium',
        observedAt: '2026-07-28T00:00:00.000Z',
      },
    ])
    expect(details.wifi).toEqual({
      value: 'usable',
      provenance: 'curator',
      confidence: 'medium',
      observedAt: '2026-07-28T00:00:00.000Z',
    })
    expect(details.seating).toEqual({
      value: 'unknown',
      provenance: null,
      confidence: null,
      observedAt: null,
    })
    expect(emptyAttributeDetails().power.value).toBe('unknown')
  })
})
