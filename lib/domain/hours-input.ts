import { z } from 'zod'
import { weeklyHoursV1Schema } from './hours'
import { confidenceLevelSchema } from './provenance'

// Operator-entered hours input (Step 4 operator-curation slice). The Server
// Action normalizes per-day form fields into a `WeeklyHoursV1` candidate and
// this schema owns validation: the full versioned-schedule rules (interval
// ordering, non-overlap, unknown ≠ closed) come from `weeklyHoursV1Schema`.
// Hours are facts only — never free text. Publication requires all seven days
// known (Decision 28).
//
// `osmSource` (Decision 29): present when the schedule was applied from an OSM
// lookup — the save then records `imported` provenance with the OSM element as
// its source reference and the element's last-edit time as `observed_at`,
// alongside the operator's verification. Absent = plain curator entry.

export const osmHoursSourceSchema = z.object({
  osmType: z.enum(['node', 'way']),
  osmId: z.string().regex(/^\d{1,19}$/, 'OSM id must be numeric'),
  observedAt: z.iso.datetime().nullable(),
})

export type OsmHoursSource = z.infer<typeof osmHoursSourceSchema>

export const setCafeHoursInputSchema = z.object({
  placeId: z.uuid(),
  confidence: confidenceLevelSchema,
  schedule: weeklyHoursV1Schema,
  osmSource: osmHoursSourceSchema.optional(),
})

export type SetCafeHoursInput = z.infer<typeof setCafeHoursInputSchema>
