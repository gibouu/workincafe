import { z } from 'zod'
import { weeklyHoursV1Schema } from './hours'
import { confidenceLevelSchema } from './provenance'

// Operator-entered hours input (Step 4 operator-curation slice). The Server
// Action normalizes per-day form fields into a `WeeklyHoursV1` candidate and
// this schema owns validation: the full versioned-schedule rules (interval
// ordering, non-overlap, unknown ≠ closed) come from `weeklyHoursV1Schema`.
// Hours are facts only — never free text — and are never required for
// publication (Decision 9).

export const setCafeHoursInputSchema = z.object({
  placeId: z.uuid(),
  confidence: confidenceLevelSchema,
  schedule: weeklyHoursV1Schema,
})

export type SetCafeHoursInput = z.infer<typeof setCafeHoursInputSchema>
