import { z } from 'zod'
import { latitudeSchema, longitudeSchema } from './places'

// WorkinCafe's normalized Overture matching-index record (Decision 9; slice 2).
// The index is internal staging: Overture is the primary independent enrichment
// source for basic facts and stable GERS identities — never the relevance or
// membership source, and an Overture record alone never makes a venue a
// candidate. Records here are Overture-provenance data and persistable; the
// provider-specific extract parsing lives in lib/integrations/overture, and this
// schema is the single contract an index row must satisfy.
//
// GERS ids are validated as non-empty bounded text — not a provider-specific
// regular expression — per the source-reference precedent (lib/domain/sources).

export const GERS_ID_MAX_LENGTH = 255
export const OVERTURE_NAME_MAX_LENGTH = 500
export const OVERTURE_CATEGORY_MAX_LENGTH = 120
export const OVERTURE_ALTERNATE_CATEGORIES_MAX = 10
export const OVERTURE_TEXT_MAX_LENGTH = 500
export const OVERTURE_SOURCE_VERSION_MAX_LENGTH = 60

const boundedText = (max: number) => z.string().trim().min(1).max(max)

export const overtureIndexRecordSchema = z.object({
  gersId: boundedText(GERS_ID_MAX_LENGTH),
  name: boundedText(OVERTURE_NAME_MAX_LENGTH),
  primaryCategory: boundedText(OVERTURE_CATEGORY_MAX_LENGTH).optional(),
  alternateCategories: z
    .array(boundedText(OVERTURE_CATEGORY_MAX_LENGTH))
    .max(OVERTURE_ALTERNATE_CATEGORIES_MAX)
    .default([]),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  address: boundedText(OVERTURE_TEXT_MAX_LENGTH).optional(),
  website: boundedText(OVERTURE_TEXT_MAX_LENGTH).optional(),
  phone: boundedText(OVERTURE_TEXT_MAX_LENGTH).optional(),
  // Overture's own place-existence confidence, when present (0..1).
  confidence: z.number().min(0).max(1).optional(),
})

export type OvertureIndexRecord = z.infer<typeof overtureIndexRecordSchema>

export const overtureSourceVersionSchema = boundedText(OVERTURE_SOURCE_VERSION_MAX_LENGTH)
