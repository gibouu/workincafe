import { describe, expect, it } from 'vitest'
import { parseExtractLine } from '@/lib/integrations/overture/extract'
import { OVERTURE_ALTERNATE_CATEGORIES_MAX } from '@/lib/domain/overture-index'

// Tier 1 coverage for the Overture extract-line parser: all external input is
// validated; structural problems skip a line (typed reason), optional-field
// problems degrade to absent without losing the record.

function feature(overrides: { geometry?: unknown; properties?: Record<string, unknown> }): string {
  return JSON.stringify({
    type: 'Feature',
    geometry: overrides.geometry ?? { type: 'Point', coordinates: [-79.3832, 43.6532] },
    properties: {
      id: 'gers-abc123',
      names: { primary: 'Sam James Coffee Bar' },
      categories: { primary: 'coffee_shop', alternate: ['cafe'] },
      addresses: [{ freeform: '150 King St W' }],
      websites: ['https://example.test'],
      phones: ['+1-416-555-0100'],
      confidence: 0.93,
      ...overrides.properties,
    },
  })
}

describe('parseExtractLine', () => {
  it('parses a full feature into a normalized index record', () => {
    const result = parseExtractLine(feature({}))
    expect(result).toEqual({
      status: 'record',
      record: {
        gersId: 'gers-abc123',
        name: 'Sam James Coffee Bar',
        primaryCategory: 'coffee_shop',
        alternateCategories: ['cafe'],
        latitude: 43.6532,
        longitude: -79.3832,
        address: '150 King St W',
        website: 'https://example.test',
        phone: '+1-416-555-0100',
        confidence: 0.93,
      },
    })
  })

  it('skips blank lines and invalid JSON with typed reasons', () => {
    expect(parseExtractLine('   ')).toEqual({ status: 'skipped', reason: 'empty_line' })
    expect(parseExtractLine('{not json')).toEqual({ status: 'skipped', reason: 'invalid_json' })
  })

  it('skips non-point geometries (the index is point-based)', () => {
    const line = feature({ geometry: { type: 'Polygon', coordinates: [[[0, 0]]] } })
    expect(parseExtractLine(line)).toEqual({ status: 'skipped', reason: 'not_a_point_feature' })
  })

  it('skips features missing the GERS id or primary name', () => {
    expect(parseExtractLine(feature({ properties: { id: undefined } }))).toEqual({
      status: 'skipped',
      reason: 'missing_id_or_name',
    })
    expect(parseExtractLine(feature({ properties: { names: {} } }))).toEqual({
      status: 'skipped',
      reason: 'missing_id_or_name',
    })
  })

  it('skips out-of-range coordinates as invalid records', () => {
    const line = feature({ geometry: { type: 'Point', coordinates: [-181, 43.6] } })
    expect(parseExtractLine(line)).toEqual({ status: 'skipped', reason: 'invalid_record' })
  })

  it('degrades bad optional fields to absent instead of losing the record', () => {
    const result = parseExtractLine(
      feature({
        properties: {
          categories: { primary: 'x'.repeat(500), alternate: ['ok', 'y'.repeat(500)] },
          addresses: [],
          websites: null,
          phones: undefined,
          confidence: null,
        },
      }),
    )
    expect(result.status).toBe('record')
    if (result.status !== 'record') return
    expect(result.record.primaryCategory).toBeUndefined()
    expect(result.record.alternateCategories).toEqual(['ok'])
    expect(result.record.address).toBeUndefined()
    expect(result.record.website).toBeUndefined()
    expect(result.record.phone).toBeUndefined()
    expect(result.record.confidence).toBeUndefined()
  })

  it('caps alternate categories at the domain bound', () => {
    const many = Array.from({ length: 25 }, (_, i) => `cat-${i}`)
    const result = parseExtractLine(feature({ properties: { categories: { alternate: many } } }))
    expect(result.status).toBe('record')
    if (result.status !== 'record') return
    expect(result.record.alternateCategories).toHaveLength(OVERTURE_ALTERNATE_CATEGORIES_MAX)
  })
})
