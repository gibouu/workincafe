import { isAttendedProvenance, type ObservationDecision, type ProvenanceKind } from './provenance'

// Pure provenance-precedence logic for promoting an attribute observation to be
// the current value (Step 3B ruling 2). Provenance precedence is
// application-owned — not a blanket database trigger — because it depends on
// actor intent and reviewed-override context. This function is the decision
// core; the transactional use case (lib/application) and the database
// append-only / current-pointer invariants sit around it.
//
// Rules:
//   - A current pointer may only reference an *accepted* observation, so a
//     proposal whose latest decision is not `accepted` is always rejected.
//   - An authorized operator may deliberately promote any accepted observation
//     (including an imported one) — this is the reviewed-override path.
//   - An unattended actor (system/script) may set the current value only when
//     it does not overwrite attended (curator/measurement) state: allowed when
//     there is no current value or the current value is itself an import;
//     otherwise it is a conflict that creates review work rather than a
//     silent overwrite.

export type PromotionActor =
  { kind: 'operator'; operatorUserId: string } | { kind: 'system' } | { kind: 'script' }

export interface PromotionDecisionInput {
  hasCurrent: boolean
  currentProvenance: ProvenanceKind | null
  proposedProvenance: ProvenanceKind
  proposedLatestDecision: ObservationDecision | null
  actor: PromotionActor
}

export type PromotionRejectReason =
  'observation_not_accepted' | 'unattended_cannot_override_curated'

export type PromotionOutcome =
  | { action: 'promote' }
  | {
      action: 'reject'
      reason: PromotionRejectReason
      /** When set, the caller should record this curation event as review work. */
      recordConflict: boolean
    }

export function decidePromotion(input: PromotionDecisionInput): PromotionOutcome {
  if (input.proposedLatestDecision !== 'accepted') {
    return { action: 'reject', reason: 'observation_not_accepted', recordConflict: false }
  }

  if (input.actor.kind === 'operator') {
    // Deliberate, authorized review may promote any accepted observation.
    return { action: 'promote' }
  }

  // Unattended (system/script).
  if (!input.hasCurrent || input.currentProvenance === null) {
    return { action: 'promote' }
  }
  if (isAttendedProvenance(input.currentProvenance)) {
    // Never silently overwrite curated/measured state — flag for human review.
    return { action: 'reject', reason: 'unattended_cannot_override_curated', recordConflict: true }
  }
  // Current value is itself an unattended import — safe to update.
  return { action: 'promote' }
}
