import { ATTRIBUTE_KINDS, type AttributeKind, type AttributeValue } from './attributes'
import type { WeeklyHoursV1 } from './hours'
import type { ConfidenceLevel, ProvenanceKind } from './provenance'

// Public-facing café view types + pure builders (Decision 25 read side). These
// are the narrow shapes the application layer returns to Server Components; they
// carry only WorkinCafe-owned canonical data. `unknown` is preserved as a
// first-class value and is never rendered as a negative.

export type CafeAttributes = Record<AttributeKind, AttributeValue>

export interface PublishedCafeSummary {
  id: string
  slug: string
  name: string
  neighborhood: string | null
  latitude: number
  longitude: number
  attributes: CafeAttributes
}

export interface CafeAttributeDetail {
  value: AttributeValue
  provenance: ProvenanceKind | null
  confidence: ConfidenceLevel | null
  observedAt: string | null
}

export type CafeAttributeDetails = Record<AttributeKind, CafeAttributeDetail>

export interface PublishedCafeDetail extends PublishedCafeSummary {
  address: string | null
  website: string | null
  phone: string | null
  attributeDetails: CafeAttributeDetails
  hours: WeeklyHoursV1 | null
}

/** Every attribute kind defaults to `unknown` — absence is never a negative. */
export function emptyAttributes(): CafeAttributes {
  return Object.fromEntries(ATTRIBUTE_KINDS.map((k) => [k, 'unknown'])) as CafeAttributes
}

/** Fold current-attribute rows for one place into a complete kind→value record,
 * defaulting any kind without a current observation to `unknown`. */
export function buildAttributes(
  rows: ReadonlyArray<{ kind: AttributeKind; value: AttributeValue }>,
): CafeAttributes {
  const attributes = emptyAttributes()
  for (const row of rows) {
    attributes[row.kind] = row.value
  }
  return attributes
}

function emptyAttributeDetail(): CafeAttributeDetail {
  return { value: 'unknown', provenance: null, confidence: null, observedAt: null }
}

export function emptyAttributeDetails(): CafeAttributeDetails {
  return Object.fromEntries(
    ATTRIBUTE_KINDS.map((k) => [k, emptyAttributeDetail()]),
  ) as CafeAttributeDetails
}

/** Fold detailed current-attribute rows (with provenance/confidence/date) for one
 * place into a complete record, defaulting missing kinds to an unknown detail. */
export function buildAttributeDetails(
  rows: ReadonlyArray<{
    kind: AttributeKind
    value: AttributeValue
    provenance: ProvenanceKind
    confidence: ConfidenceLevel
    observedAt: string
  }>,
): CafeAttributeDetails {
  const details = emptyAttributeDetails()
  for (const row of rows) {
    details[row.kind] = {
      value: row.value,
      provenance: row.provenance,
      confidence: row.confidence,
      observedAt: row.observedAt,
    }
  }
  return details
}
