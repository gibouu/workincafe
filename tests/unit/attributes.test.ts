import { describe, expect, it } from 'vitest'
import {
  ATTRIBUTE_KINDS,
  ATTRIBUTE_VALUES,
  ATTRIBUTE_VALUE_DEFINITIONS,
  attributePairSchema,
  attributeValueSchemas,
  isValidAttributePair,
} from '@/lib/domain/attributes'

describe('attribute vocabularies (domain source of truth)', () => {
  it('has exactly four launch kinds, each with five values including unknown', () => {
    expect([...ATTRIBUTE_KINDS]).toEqual(['wifi', 'power', 'noise', 'seating'])
    for (const kind of ATTRIBUTE_KINDS) {
      expect(ATTRIBUTE_VALUES[kind]).toHaveLength(5)
      expect(ATTRIBUTE_VALUES[kind]).toContain('unknown')
      expect(new Set(ATTRIBUTE_VALUES[kind]).size).toBe(5)
    }
  })

  it('#12 the pair schema enforces the matrix, not merely separate lists', () => {
    expect(attributePairSchema.safeParse({ kind: 'wifi', value: 'fast' }).success).toBe(true)
    // 'abundant' is valid for power but must be rejected for wifi.
    expect(attributePairSchema.safeParse({ kind: 'wifi', value: 'abundant' }).success).toBe(false)
    expect(attributePairSchema.safeParse({ kind: 'power', value: 'abundant' }).success).toBe(true)
    // 'lively' is a noise value, not a seating value.
    expect(attributePairSchema.safeParse({ kind: 'seating', value: 'lively' }).success).toBe(false)
    expect(isValidAttributePair('wifi', 'abundant')).toBe(false)
    expect(isValidAttributePair('power', 'abundant')).toBe(true)
  })

  it('#13 unknown and none are distinct valid values for every applicable kind', () => {
    for (const kind of ATTRIBUTE_KINDS) {
      const schema = attributeValueSchemas[kind]
      expect(schema.safeParse('unknown').success).toBe(true)
      if (ATTRIBUTE_VALUES[kind].includes('none' as never)) {
        expect(schema.safeParse('none').success).toBe(true)
        expect('unknown').not.toBe('none')
      }
    }
  })

  it('documents an operational definition for every value', () => {
    for (const kind of ATTRIBUTE_KINDS) {
      for (const value of ATTRIBUTE_VALUES[kind]) {
        const def = (ATTRIBUTE_VALUE_DEFINITIONS[kind] as Record<string, string>)[value]
        expect(def, `${kind}/${value} needs a definition`).toBeTruthy()
        expect(def.length).toBeGreaterThan(15)
      }
    }
  })
})
