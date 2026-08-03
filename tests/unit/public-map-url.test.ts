import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PUBLIC_MAP_URL_STATE,
  parsePublicMapUrl,
  publicMapHref,
  serializePublicMapUrl,
} from '@/lib/client-state/public-map-url'

// Tier 1 coverage for the single public-map URL codec (Decision 15): parse
// validation with unsupported-value rejection, canonical serialization with
// default omission, and round-tripping.

describe('parsePublicMapUrl', () => {
  it('parses a valid selected-café slug', () => {
    expect(parsePublicMapUrl({ cafe: 'cafe23' })).toEqual({ selectedCafeSlug: 'cafe23' })
  })

  it('defaults when the parameter is absent', () => {
    expect(parsePublicMapUrl({})).toEqual(DEFAULT_PUBLIC_MAP_URL_STATE)
  })

  it('rejects unsupported values to the default, never guessing', () => {
    for (const cafe of [
      ['a', 'b'] as string[], // repeated parameter
      'Not A Slug',
      'UPPER',
      'trailing-',
      '-leading',
      'a'.repeat(200),
      '',
      'café', // non-ASCII
    ]) {
      expect(parsePublicMapUrl({ cafe }), JSON.stringify(cafe)).toEqual(
        DEFAULT_PUBLIC_MAP_URL_STATE,
      )
    }
  })

  it('ignores unknown parameters', () => {
    expect(parsePublicMapUrl({ order: 'g-relevance', cafe: 'cafe23' })).toEqual({
      selectedCafeSlug: 'cafe23',
    })
  })
})

describe('serializePublicMapUrl / publicMapHref', () => {
  it('omits defaults entirely', () => {
    expect(serializePublicMapUrl({ selectedCafeSlug: null })).toBe('')
    expect(publicMapHref({ selectedCafeSlug: null })).toBe('/')
  })

  it('serializes the selected café canonically', () => {
    expect(serializePublicMapUrl({ selectedCafeSlug: 'cafe23' })).toBe('cafe=cafe23')
    expect(publicMapHref({ selectedCafeSlug: 'cafe23' })).toBe('/?cafe=cafe23')
  })

  it('round-trips through parse', () => {
    const state = { selectedCafeSlug: 'sam-james-coffee-bar' }
    expect(parsePublicMapUrl({ cafe: state.selectedCafeSlug })).toEqual(state)
  })
})
