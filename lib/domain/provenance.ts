import { z } from 'zod'

// Provenance, confidence, and review-decision vocabularies shared by attribute
// observations and hours records (Decisions 3, 9; Step 3B rulings 2 & 3).
//
// Provenance-kind scope (baseline): the confirmed launch workflows produce
// operator-authored observations (`curator`) and independently-sourced imports
// (`imported`); `measurement` is included because the promotion-precedence rule
// (Step 3B ruling 2) explicitly reasons about a later measurement superseding a
// curator observation. `community` is deliberately excluded: Decision 8 disables
// public registration, so no community-authored provenance exists at launch. A
// future provenance kind is a reviewed forward migration + vocabulary change.

export const PROVENANCE_KINDS = ['imported', 'curator', 'measurement'] as const
export type ProvenanceKind = (typeof PROVENANCE_KINDS)[number]

export const PROVENANCE_KIND_DEFINITIONS: Record<ProvenanceKind, string> = {
  imported:
    'Unattended import from an approved independent source (e.g. Overture). Must never silently overwrite curated state.',
  curator: 'Recorded or verified by an authorized WorkinCafe operator during review.',
  measurement:
    'Derived from an objective measurement pipeline. Reserved; no measurement pipeline exists at launch.',
}

/** True when the provenance represents attended (human/objective) authority that
 * an unattended import must not silently overwrite. */
export function isAttendedProvenance(kind: ProvenanceKind): boolean {
  return kind === 'curator' || kind === 'measurement'
}

export const CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number]

// Review decisions on an observation (Step 3B ruling 2). Append-only: a later
// decision supersedes an earlier one without modifying it.
export const OBSERVATION_DECISIONS = ['accepted', 'rejected'] as const
export type ObservationDecision = (typeof OBSERVATION_DECISIONS)[number]

export const provenanceKindSchema = z.enum(PROVENANCE_KINDS)
export const confidenceLevelSchema = z.enum(CONFIDENCE_LEVELS)
export const observationDecisionSchema = z.enum(OBSERVATION_DECISIONS)
