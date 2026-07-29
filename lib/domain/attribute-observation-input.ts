import { z } from 'zod'
import { attributeKindSchema, isValidAttributePair } from './attributes'
import { confidenceLevelSchema } from './provenance'

// Operator-authored attribute-observation input (Step 4 operator-curation
// slice). This is the single validation contract for recording new curator
// evidence; the Server Action forwards raw form values and this schema owns
// coercion, trimming, and bounds. Only operator-authored content is accepted
// here — no provider-derived content crosses this boundary. The (kind, value)
// matrix is the same one the database CHECK enforces.

export const OBSERVATION_NOTE_MAX_LENGTH = 2000

// Form fields arrive as strings; an omitted optional field is absent, but an
// empty text input arrives as "". Normalize blank/whitespace-only values to
// undefined so the column stays NULL rather than storing "".
const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

export const recordObservationInputSchema = z
  .object({
    placeId: z.uuid(),
    kind: attributeKindSchema,
    value: z.string(),
    confidence: confidenceLevelSchema,
    // The date the operator made the observation — never a future date.
    observedAt: z.coerce
      .date()
      .refine((d) => d.getTime() <= Date.now(), 'observed date cannot be in the future'),
    note: z.preprocess(
      blankToUndefined,
      z.string().trim().min(1).max(OBSERVATION_NOTE_MAX_LENGTH).optional(),
    ),
  })
  .superRefine((val, ctx) => {
    if (!isValidAttributePair(val.kind, val.value)) {
      ctx.addIssue({
        code: 'custom',
        message: `"${val.value}" is not a valid value for attribute kind "${val.kind}"`,
        path: ['value'],
      })
    }
  })

export type RecordObservationInput = z.infer<typeof recordObservationInputSchema>
