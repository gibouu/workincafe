import { z } from 'zod'
import { attributeKindSchema } from './attributes'

// Append-only curation events (Step 3B "Curation events"). Structured top-level
// fields carry the event; each event type has a typed, bounded details schema.
// Curation events NEVER carry raw provider payloads, Google content, semantic
// query text, review text, photo identifiers, arbitrary error objects, secrets,
// or personal data — a database size constraint additionally prevents the table
// becoming a generic log.

export const ACTOR_KINDS = ['operator', 'system', 'script'] as const
export type ActorKind = (typeof ACTOR_KINDS)[number]

export const CURATION_EVENT_TYPES = [
  'place_created',
  'place_published',
  'place_hidden',
  'place_closed',
  'place_marked_duplicate',
  'attribute_promoted',
  'attribute_conflict_detected',
  'hours_updated',
] as const
export type CurationEventType = (typeof CURATION_EVENT_TYPES)[number]

const uuidSchema = z.uuid()

// Typed details schema per event type. `strictObject` rejects unknown keys so
// the details column cannot quietly accumulate arbitrary fields.
export const CURATION_EVENT_DETAILS_SCHEMAS = {
  place_created: z.strictObject({}),
  place_published: z.strictObject({}),
  place_hidden: z.strictObject({}),
  place_closed: z.strictObject({}),
  place_marked_duplicate: z.strictObject({ duplicateOfPlaceId: uuidSchema }),
  attribute_promoted: z.strictObject({
    kind: attributeKindSchema,
    fromObservationId: uuidSchema.nullable(),
    toObservationId: uuidSchema,
  }),
  attribute_conflict_detected: z.strictObject({
    kind: attributeKindSchema,
    currentObservationId: uuidSchema.nullable(),
    proposedObservationId: uuidSchema,
  }),
  hours_updated: z.strictObject({}),
} as const satisfies Record<CurationEventType, z.ZodType>

export const actorKindSchema = z.enum(ACTOR_KINDS)
export const curationEventTypeSchema = z.enum(CURATION_EVENT_TYPES)

/** Validate an event's details against the schema registered for its type. */
export function parseCurationEventDetails(eventType: CurationEventType, details: unknown) {
  return CURATION_EVENT_DETAILS_SCHEMAS[eventType].parse(details ?? {})
}
