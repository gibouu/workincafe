import { z } from 'zod'

// External source identities for `place_source_refs` (Step 3B source-reference
// amendments). These are external *identity* references only — never provenance
// classes (`curator`/`community` are NOT source kinds), and never a place to
// store provider payloads.
//
// For `google_places`, the external id is the Google Place ID and nothing else
// from any Google response is ever stored (GP-1 IDs-only boundary). Place IDs
// are validated only as non-empty bounded text, not with a brittle regular
// expression (Step 3B ruling: do not over-constrain the format).

export const SOURCE_KINDS = [
  'google_places',
  'overture',
  'toronto_open_data',
  'dinesafe',
  'official_website',
  'osm',
] as const
export type SourceKind = (typeof SOURCE_KINDS)[number]

export const SOURCE_KIND_DEFINITIONS: Record<SourceKind, string> = {
  google_places:
    'Google Place ID from the GP-1 candidate-seeding workflow. IDs-only; no other Google field is stored.',
  overture: 'Overture Places GERS id — the primary independent enrichment identity.',
  toronto_open_data: 'City of Toronto Open Data record identifier.',
  dinesafe: 'Toronto DineSafe establishment identifier (existence/licensing/status signal only).',
  official_website: 'The venue’s own official website, used as a canonical-fact source.',
  osm: 'OpenStreetMap element reference (`node/<id>` or `way/<id>`) identifying the OSM venue an operator-confirmed hours import came from (Decision 29). ODbL: attribution is required wherever OSM-derived hours are displayed.',
}

export const EXTERNAL_ID_MAX_LENGTH = 255

export const sourceKindSchema = z.enum(SOURCE_KINDS)
export const externalIdSchema = z.string().trim().min(1).max(EXTERNAL_ID_MAX_LENGTH)
