import { z } from 'zod'
import { latitudeSchema, longitudeSchema, slugSchema } from './places'

// Operator-authored café creation input (Step 4 operator-write slice). This is
// the single validation contract for a new WorkinCafe record; the Server Action
// forwards raw form values and this schema owns coercion, trimming, and bounds.
// Only WorkinCafe-owned canonical fields are accepted here — no provider-derived
// content crosses this boundary.

// Form fields arrive as strings; an omitted optional field is absent, but an
// empty text input arrives as "". Normalize blank/whitespace-only values to
// undefined so the column stays NULL rather than storing "".
const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

const optionalText = (max: number) =>
  z.preprocess(blankToUndefined, z.string().trim().min(1).max(max).optional())

export const createCafeInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(200),
  slug: slugSchema,
  // Numbers come off the form as strings; coerce, then apply the domain ranges.
  latitude: z.coerce.number().pipe(latitudeSchema),
  longitude: z.coerce.number().pipe(longitudeSchema),
  address: optionalText(500),
  neighborhood: optionalText(120),
  website: z.preprocess(blankToUndefined, z.url().max(500).optional()),
  phone: optionalText(60),
})

export type CreateCafeInput = z.infer<typeof createCafeInputSchema>

// The two operator-initiated publication transitions in this slice (Decision 8 —
// there is no automatic publication; `draft` is the creation default and is not
// a transition target here). Each maps to a curation event when applied.
export const PUBLICATION_TRANSITIONS = ['published', 'hidden'] as const
export type PublicationTransition = (typeof PUBLICATION_TRANSITIONS)[number]
