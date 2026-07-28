import { z } from 'zod'

// Study-suitability attribute vocabularies (Step 3B ruling 1). These pure
// domain constants are the single TypeScript source of truth; Zod schemas are
// derived from them, database CHECK constraints enforce the same kind/value
// matrix, and UI labels are mapped from these values. Drizzle's text-column
// `enum` option only gives TypeScript inference — it does not enforce runtime
// database values — so the matrix is enforced in the database separately.
//
// `unknown` is a first-class value for every kind and must never be converted
// to `none`: "not assessed" is not the same as "confirmed absent".

export const ATTRIBUTE_KINDS = ['wifi', 'power', 'noise', 'seating'] as const
export type AttributeKind = (typeof ATTRIBUTE_KINDS)[number]

export const WIFI_VALUES = ['unknown', 'none', 'unreliable', 'usable', 'fast'] as const
export const POWER_VALUES = ['unknown', 'none', 'limited', 'available', 'abundant'] as const
export const NOISE_VALUES = ['unknown', 'very_quiet', 'quiet', 'moderate', 'lively'] as const
export const SEATING_VALUES = ['unknown', 'none', 'limited', 'adequate', 'ample'] as const

export const ATTRIBUTE_VALUES = {
  wifi: WIFI_VALUES,
  power: POWER_VALUES,
  noise: NOISE_VALUES,
  seating: SEATING_VALUES,
} as const satisfies Record<AttributeKind, readonly string[]>

export type AttributeValue<K extends AttributeKind = AttributeKind> =
  (typeof ATTRIBUTE_VALUES)[K][number]

// Operational definitions — specific enough that two curators can generally make
// the same choice for the same café (Step 3B ruling 1).
export const ATTRIBUTE_VALUE_DEFINITIONS: {
  [K in AttributeKind]: Record<(typeof ATTRIBUTE_VALUES)[K][number], string>
} = {
  wifi: {
    unknown:
      'Not yet assessed by WorkinCafe; no confident observation exists. Never inferred from absence of data.',
    none: 'No customer Wi-Fi usable for study — none offered, or offered but effectively unusable (paywalled, broken, or blocked).',
    unreliable:
      'Wi-Fi exists but is frequently slow, drops connections, or needs repeated reconnection — not dependable for sustained work.',
    usable:
      'Dependable for ordinary study/work (email, documents, web, light video calls) though not notably fast.',
    fast: 'Consistently fast and dependable throughout a typical session, comfortable for heavy use (large transfers, video calls).',
  },
  power: {
    unknown:
      'Not yet assessed; no confident observation exists. Never inferred from absence of data.',
    none: 'No customer-accessible power outlets.',
    limited:
      'A few outlets exist but are scarce or hard to get — only a handful of seats near power, often already occupied.',
    available:
      'A reasonable number of outlets; a studier can usually find one without much effort.',
    abundant: 'Outlets at most or all seats; finding power is essentially never a problem.',
  },
  noise: {
    unknown:
      'Not yet assessed; no confident observation exists. Never inferred from absence of data.',
    very_quiet: 'Consistently near-silent, library-like; conversation is rare or hushed.',
    quiet: 'Generally calm with low background noise; easy to concentrate.',
    moderate:
      'Noticeable but tolerable ambient noise/chatter; most people can concentrate, sometimes with headphones.',
    lively:
      'Loud or busy much of the time; sustained focus is difficult without noise-cancelling headphones.',
  },
  seating: {
    // The launch `seating` attribute means practical seating availability for
    // studying or working — not comfort, density, or room size (Step 3B ruling 1).
    unknown:
      'Not yet assessed; no confident observation exists. Never inferred from absence of data.',
    none: 'No seating usable for studying/working (e.g. standing/counter only, or nothing laptop-friendly).',
    limited: 'Few study-usable seats; often full; hard to secure a spot at busy times.',
    adequate:
      'A reasonable number of study-usable seats; a studier can usually find one outside peak times.',
    ample: 'Plenty of study-usable seating; finding a spot is rarely a problem.',
  },
}

/** True when `value` is a valid value for `kind` (the enforced matrix). */
export function isValidAttributePair(kind: string, value: string): boolean {
  const values = (ATTRIBUTE_VALUES as Record<string, readonly string[]>)[kind]
  return values !== undefined && values.includes(value)
}

export const attributeKindSchema = z.enum(ATTRIBUTE_KINDS)

/** Per-kind value schemas, for validating a value already known to be of a kind. */
export const attributeValueSchemas = {
  wifi: z.enum(WIFI_VALUES),
  power: z.enum(POWER_VALUES),
  noise: z.enum(NOISE_VALUES),
  seating: z.enum(SEATING_VALUES),
} as const

/** Validates a (kind, value) pair against the matrix — rejects e.g. wifi/abundant. */
export const attributePairSchema = z
  .object({ kind: attributeKindSchema, value: z.string() })
  .superRefine((val, ctx) => {
    if (!isValidAttributePair(val.kind, val.value)) {
      ctx.addIssue({
        code: 'custom',
        message: `"${val.value}" is not a valid value for attribute kind "${val.kind}"`,
        path: ['value'],
      })
    }
  })

export type AttributePair = { kind: AttributeKind; value: AttributeValue }
