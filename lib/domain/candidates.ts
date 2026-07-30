import { z } from 'zod'
import { GERS_ID_MAX_LENGTH } from './overture-index'
import { latitudeSchema, longitudeSchema, slugSchema } from './places'

// GP-1 candidate lifecycle (Decision 9; slice 2 pt.2). A candidate is a Google
// Place ID — nothing else from any Google response — awaiting human review.
// Decisions are append-only, reason-coded evidence of the operator's judgment;
// the reason vocabulary and its operational definitions are deliberately
// specific: they are both the review rubric and, with the versioned
// decision-time feature snapshot, the future training-label contract approved
// in the slice design (label capture only — no model, no predictions).

export const CANDIDATE_STATUSES = ['pending', 'approved', 'rejected', 'deferred'] as const
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number]

export const CANDIDATE_DECISIONS = ['approved', 'rejected', 'deferred'] as const
export type CandidateDecision = (typeof CANDIDATE_DECISIONS)[number]

export const CANDIDATE_REJECT_REASONS = [
  'not_a_cafe',
  'chain',
  'takeout_only_no_seating',
  'not_study_suitable',
  'permanently_closed',
  'duplicate',
  'outside_service_area',
  'insufficient_evidence',
  'other',
] as const
export type CandidateRejectReason = (typeof CANDIDATE_REJECT_REASONS)[number]

// Transfer-aware rubric: reasons marked portable encode venue judgment that
// transfers to any city; local reasons are Toronto-graph housekeeping a future
// model must exclude from training.
export const CANDIDATE_REJECT_REASON_DEFINITIONS: Record<
  CandidateRejectReason,
  { definition: string; portable: boolean }
> = {
  not_a_cafe: {
    definition: 'Not a café at all (retail, office, grocery, venue of another type entirely).',
    portable: true,
  },
  chain: {
    definition: 'A chain location excluded by current curation policy.',
    portable: true,
  },
  takeout_only_no_seating: {
    definition: 'Espresso bar / takeout window with no usable seating for staying.',
    portable: true,
  },
  not_study_suitable: {
    definition:
      'A real café, but clearly unsuited to working/studying (e.g. dining-focused, time-capped, hostile to laptops).',
    portable: true,
  },
  permanently_closed: {
    definition: 'The venue is permanently closed.',
    portable: true,
  },
  duplicate: {
    definition:
      'Already represented — by an existing WorkinCafe record or an earlier candidate for the same venue.',
    portable: false,
  },
  outside_service_area: {
    definition: 'Outside the active service-area boundary.',
    portable: false,
  },
  insufficient_evidence: {
    definition: 'Cannot be assessed with available information; revisit only with better evidence.',
    portable: true,
  },
  other: {
    definition: 'None of the defined reasons fits — the note explains (required).',
    portable: true,
  },
}

const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)
export const CANDIDATE_NOTE_MAX_LENGTH = 2000
// Final decisions (approve/reject) require a substantive note capturing the
// operator's exact reasoning — the richest part of the label-capture design
// (technical-lead instruction, 2026-07-30). The note is operator-AUTHORED
// judgment in the operator's own words; it must never contain copied Google
// content (review text, photo links) — the same boundary the persistence rules
// draw everywhere else. Defer notes stay optional.
export const CANDIDATE_NOTE_MIN_LENGTH = 10

// The single validation contract for a review decision. `approved` requires
// draft-café fields: from a matched Overture record (matchedGersId + editable
// name/slug) or operator-entered manually when no independent match exists —
// either way the fields are operator-confirmed, never Google-derived.
export const candidateDecisionInputSchema = z
  .object({
    candidateId: z.uuid(),
    decision: z.enum(CANDIDATE_DECISIONS),
    reasonCode: z.preprocess(blankToUndefined, z.enum(CANDIDATE_REJECT_REASONS).optional()),
    note: z.preprocess(
      blankToUndefined,
      z.string().trim().min(1).max(CANDIDATE_NOTE_MAX_LENGTH).optional(),
    ),
    matchedGersId: z.preprocess(
      blankToUndefined,
      z.string().trim().min(1).max(GERS_ID_MAX_LENGTH).optional(),
    ),
    name: z.preprocess(blankToUndefined, z.string().trim().min(1).max(200).optional()),
    slug: z.preprocess(blankToUndefined, slugSchema.optional()),
    latitude: z.preprocess(blankToUndefined, z.coerce.number().pipe(latitudeSchema).optional()),
    longitude: z.preprocess(blankToUndefined, z.coerce.number().pipe(longitudeSchema).optional()),
  })
  .superRefine((val, ctx) => {
    // Approve and reject are final decisions: both require the reasoning note.
    if (val.decision !== 'deferred') {
      if (!val.note || val.note.length < CANDIDATE_NOTE_MIN_LENGTH) {
        ctx.addIssue({
          code: 'custom',
          message: `describe your specific reasoning in your own words (at least ${CANDIDATE_NOTE_MIN_LENGTH} characters)`,
          path: ['note'],
        })
      }
    }
    if (val.decision === 'rejected') {
      if (!val.reasonCode) {
        ctx.addIssue({
          code: 'custom',
          message: 'a rejection requires a reason',
          path: ['reasonCode'],
        })
      }
    } else if (val.reasonCode) {
      ctx.addIssue({
        code: 'custom',
        message: 'reason codes apply only to rejections',
        path: ['reasonCode'],
      })
    }
    if (val.decision === 'approved') {
      if (!val.name || !val.slug) {
        ctx.addIssue({
          code: 'custom',
          message: 'approval requires a name and slug for the draft café',
          path: ['name'],
        })
      }
      if (!val.matchedGersId && (val.latitude === undefined || val.longitude === undefined)) {
        ctx.addIssue({
          code: 'custom',
          message: 'approval requires a matched Overture record or manual coordinates',
          path: ['matchedGersId'],
        })
      }
    }
  })

export type CandidateDecisionInput = z.infer<typeof candidateDecisionInputSchema>

// Versioned decision-time feature snapshot (label capture). Built SERVER-SIDE
// from our-side data only — never client-supplied, never Google-derived.
// `portable` features transfer to any future city; `local` features are
// Toronto-specific. Bump the version whenever the shape changes.
export const FEATURE_SET_VERSION = 1

export const candidateFeaturesV1Schema = z.strictObject({
  version: z.literal(FEATURE_SET_VERSION),
  portable: z.strictObject({
    overtureMatch: z.strictObject({
      matched: z.boolean(),
      primaryCategory: z.string().nullable(),
      overtureConfidence: z.number().min(0).max(1).nullable(),
      hasWebsite: z.boolean().nullable(),
    }),
  }),
  local: z.strictObject({
    insideServiceArea: z.boolean().nullable(),
  }),
})

export type CandidateFeaturesV1 = z.infer<typeof candidateFeaturesV1Schema>

/** Assemble the decision-time snapshot from loaded our-side rows (pure). */
export function buildCandidateFeaturesV1(input: {
  overtureMatch: {
    primaryCategory: string | null
    confidence: number | null
    website: string | null
  } | null
  insideServiceArea: boolean | null
}): CandidateFeaturesV1 {
  return candidateFeaturesV1Schema.parse({
    version: FEATURE_SET_VERSION,
    portable: {
      overtureMatch: {
        matched: input.overtureMatch !== null,
        primaryCategory: input.overtureMatch?.primaryCategory ?? null,
        overtureConfidence: input.overtureMatch?.confidence ?? null,
        hasWebsite: input.overtureMatch ? input.overtureMatch.website !== null : null,
      },
    },
    local: {
      insideServiceArea: input.insideServiceArea,
    },
  })
}

// Google Place IDs are validated as non-empty bounded text only (same
// precedent as external ids in lib/domain/sources — no brittle provider regex).
export const GOOGLE_PLACE_ID_MAX_LENGTH = 255
export const googlePlaceIdSchema = z.string().trim().min(1).max(GOOGLE_PLACE_ID_MAX_LENGTH)
