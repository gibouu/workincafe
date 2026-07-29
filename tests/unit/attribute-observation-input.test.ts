import { describe, expect, it } from 'vitest'
import {
  OBSERVATION_NOTE_MAX_LENGTH,
  recordObservationInputSchema,
} from '@/lib/domain/attribute-observation-input'

// Tier 1 coverage for the operator observation-input contract: the (kind, value)
// matrix, coercion of form-string fields, and blank-note normalization.

const VALID = {
  placeId: '7d9a1f9c-9f3a-4b6e-8c5d-2f1e3a4b5c6d',
  kind: 'wifi',
  value: 'usable',
  confidence: 'medium',
  observedAt: '2026-07-01',
  note: '',
}

describe('recordObservationInputSchema', () => {
  it('accepts a valid curator observation and normalizes a blank note to undefined', () => {
    const parsed = recordObservationInputSchema.parse(VALID)
    expect(parsed.kind).toBe('wifi')
    expect(parsed.value).toBe('usable')
    expect(parsed.observedAt).toBeInstanceOf(Date)
    expect(parsed.note).toBeUndefined()
  })

  it('keeps a trimmed non-blank note and bounds its length', () => {
    const parsed = recordObservationInputSchema.parse({ ...VALID, note: '  quiet corner  ' })
    expect(parsed.note).toBe('quiet corner')
    const tooLong = 'x'.repeat(OBSERVATION_NOTE_MAX_LENGTH + 1)
    expect(recordObservationInputSchema.safeParse({ ...VALID, note: tooLong }).success).toBe(false)
  })

  it('rejects a cross-kind value (the matrix, e.g. wifi/abundant)', () => {
    const res = recordObservationInputSchema.safeParse({ ...VALID, value: 'abundant' })
    expect(res.success).toBe(false)
  })

  it('accepts unknown as a first-class recordable value', () => {
    expect(recordObservationInputSchema.safeParse({ ...VALID, value: 'unknown' }).success).toBe(
      true,
    )
  })

  it('rejects an unknown attribute kind', () => {
    const res = recordObservationInputSchema.safeParse({ ...VALID, kind: 'temperature' })
    expect(res.success).toBe(false)
  })

  it('rejects a malformed place id', () => {
    expect(recordObservationInputSchema.safeParse({ ...VALID, placeId: 'nope' }).success).toBe(
      false,
    )
  })

  it('rejects an invalid confidence level', () => {
    expect(recordObservationInputSchema.safeParse({ ...VALID, confidence: 'sure' }).success).toBe(
      false,
    )
  })

  it('rejects a missing or future observation date', () => {
    expect(recordObservationInputSchema.safeParse({ ...VALID, observedAt: '' }).success).toBe(false)
    const future = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
    expect(recordObservationInputSchema.safeParse({ ...VALID, observedAt: future }).success).toBe(
      false,
    )
  })
})
