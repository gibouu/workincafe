import { z } from 'zod'

// Canonical place state vocabularies (Step 3B amendment B). Publication state and
// record lifecycle are two independent dimensions and must not be collapsed into
// one `status` enum. There is no canonical `category`/product-type column
// (Decision 3 / amendment A): at launch every published record is a
// WorkinCafe-approved café by product eligibility, not because a column says so.

export const PUBLICATION_STATES = ['draft', 'published', 'hidden'] as const
export type PublicationState = (typeof PUBLICATION_STATES)[number]

export const PUBLICATION_STATE_DEFINITIONS: Record<PublicationState, string> = {
  draft: 'Not publicly visible; in curation. The default for a new record.',
  published: 'Publicly visible. Requires record_state = active.',
  hidden:
    'Withheld from public view by a curation decision, without closing or deleting the record.',
}

export const RECORD_STATES = ['active', 'closed', 'duplicate'] as const
export type RecordState = (typeof RECORD_STATES)[number]

export const RECORD_STATE_DEFINITIONS: Record<RecordState, string> = {
  active: 'A live, distinct venue record.',
  closed:
    'The venue is closed. `closed_at` is set. Closure is a human curation decision, not a provider fact.',
  duplicate:
    'Superseded by another record. `duplicate_of_place_id` points at the surviving record.',
}

// Slugs are lowercase alphanumeric words separated by single hyphens, bounded
// length. Mirrored by a database CHECK constraint + UNIQUE.
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const SLUG_MAX_LENGTH = 96

export const publicationStateSchema = z.enum(PUBLICATION_STATES)
export const recordStateSchema = z.enum(RECORD_STATES)
export const slugSchema = z
  .string()
  .min(1)
  .max(SLUG_MAX_LENGTH)
  .regex(SLUG_PATTERN, 'slug must be lowercase alphanumeric words separated by single hyphens')

// Latitude/longitude ranges (mirrored by database CHECK constraints).
export const latitudeSchema = z.number().min(-90).max(90)
export const longitudeSchema = z.number().min(-180).max(180)
