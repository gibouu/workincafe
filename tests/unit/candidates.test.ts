import { describe, expect, it } from 'vitest'
import {
  buildCandidateFeaturesV1,
  CANDIDATE_REJECT_REASON_DEFINITIONS,
  CANDIDATE_REJECT_REASONS,
  candidateDecisionInputSchema,
  candidateFeaturesV1Schema,
  FEATURE_SET_VERSION,
} from '@/lib/domain/candidates'

// Tier 1 coverage for the GP-1 decision contract and the versioned,
// server-built feature snapshot (the approved label-capture design).

const CANDIDATE_ID = '7d9a1f9c-9f3a-4b6e-8c5d-2f1e3a4b5c6d'

describe('candidateDecisionInputSchema', () => {
  it('accepts a rejection with a reason; requires one; forbids reasons elsewhere', () => {
    expect(
      candidateDecisionInputSchema.safeParse({
        candidateId: CANDIDATE_ID,
        decision: 'rejected',
        reasonCode: 'chain',
      }).success,
    ).toBe(true)
    expect(
      candidateDecisionInputSchema.safeParse({ candidateId: CANDIDATE_ID, decision: 'rejected' })
        .success,
    ).toBe(false)
    expect(
      candidateDecisionInputSchema.safeParse({
        candidateId: CANDIDATE_ID,
        decision: 'deferred',
        reasonCode: 'chain',
      }).success,
    ).toBe(false)
  })

  it('reason "other" requires a note', () => {
    expect(
      candidateDecisionInputSchema.safeParse({
        candidateId: CANDIDATE_ID,
        decision: 'rejected',
        reasonCode: 'other',
      }).success,
    ).toBe(false)
    expect(
      candidateDecisionInputSchema.safeParse({
        candidateId: CANDIDATE_ID,
        decision: 'rejected',
        reasonCode: 'other',
        note: 'venue is a private members club',
      }).success,
    ).toBe(true)
  })

  it('approval requires name+slug and a match or manual coordinates', () => {
    const base = { candidateId: CANDIDATE_ID, decision: 'approved', name: 'Cafe', slug: 'cafe' }
    expect(candidateDecisionInputSchema.safeParse(base).success).toBe(false)
    expect(
      candidateDecisionInputSchema.safeParse({ ...base, matchedGersId: 'gers-1' }).success,
    ).toBe(true)
    expect(
      candidateDecisionInputSchema.safeParse({ ...base, latitude: '43.65', longitude: '-79.38' })
        .success,
    ).toBe(true)
    expect(
      candidateDecisionInputSchema.safeParse({
        candidateId: CANDIDATE_ID,
        decision: 'approved',
        matchedGersId: 'gers-1',
      }).success,
    ).toBe(false)
  })

  it('a plain defer with an optional note parses', () => {
    expect(
      candidateDecisionInputSchema.safeParse({
        candidateId: CANDIDATE_ID,
        decision: 'deferred',
        note: '',
      }).success,
    ).toBe(true)
  })
})

describe('reject-reason rubric', () => {
  it('every reason has an operational definition and a portability tag', () => {
    for (const reason of CANDIDATE_REJECT_REASONS) {
      const entry = CANDIDATE_REJECT_REASON_DEFINITIONS[reason]
      expect(entry.definition.length).toBeGreaterThan(15)
      expect(typeof entry.portable).toBe('boolean')
    }
    // Local-graph housekeeping must be excluded from future training.
    expect(CANDIDATE_REJECT_REASON_DEFINITIONS.duplicate.portable).toBe(false)
    expect(CANDIDATE_REJECT_REASON_DEFINITIONS.outside_service_area.portable).toBe(false)
  })
})

describe('buildCandidateFeaturesV1', () => {
  it('builds a schema-valid snapshot from a match', () => {
    const features = buildCandidateFeaturesV1({
      overtureMatch: { primaryCategory: 'coffee_shop', confidence: 0.9, website: 'https://x.test' },
      insideServiceArea: true,
    })
    expect(candidateFeaturesV1Schema.parse(features)).toEqual({
      version: FEATURE_SET_VERSION,
      portable: {
        overtureMatch: {
          matched: true,
          primaryCategory: 'coffee_shop',
          overtureConfidence: 0.9,
          hasWebsite: true,
        },
      },
      local: { insideServiceArea: true },
    })
  })

  it('represents no-match and unknown containment without fabricating values', () => {
    const features = buildCandidateFeaturesV1({ overtureMatch: null, insideServiceArea: null })
    expect(features.portable.overtureMatch).toEqual({
      matched: false,
      primaryCategory: null,
      overtureConfidence: null,
      hasWebsite: null,
    })
    expect(features.local.insideServiceArea).toBeNull()
  })

  it('the snapshot schema rejects unknown keys (strict shape, versioned)', () => {
    const features = buildCandidateFeaturesV1({ overtureMatch: null, insideServiceArea: null })
    const tampered = { ...features, extra: 'nope' }
    expect(candidateFeaturesV1Schema.safeParse(tampered).success).toBe(false)
  })
})
