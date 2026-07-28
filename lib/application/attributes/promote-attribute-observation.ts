import {
  decidePromotion,
  type PromotionActor,
  type PromotionRejectReason,
} from '@/lib/domain/attribute-promotion'
import type { AttributeKind } from '@/lib/domain/attributes'
import type { ObservationDecision, ProvenanceKind } from '@/lib/domain/provenance'

// Application use case for promoting an attribute observation to the current
// value (Step 3B ruling 2). Provenance precedence is enforced here — not by a
// blanket database trigger — because it depends on actor intent and reviewed
// override. The decision core is the pure domain function `decidePromotion`; the
// transactional effects (current-pointer write + curation event) go through the
// injected port, whose only approved implementation is the lib/db repository.
// No code outside that repository/use case writes the current pointer.

export interface CurrentPointerSnapshot {
  currentObservationId: string
  provenanceKind: ProvenanceKind
}

export interface ProposedObservationSnapshot {
  observationId: string
  placeId: string
  kind: AttributeKind
  provenanceKind: ProvenanceKind
  latestDecision: ObservationDecision | null
}

export interface PromoteAttributeObservationPort {
  loadCurrent(placeId: string, kind: AttributeKind): Promise<CurrentPointerSnapshot | null>
  loadObservation(observationId: string): Promise<ProposedObservationSnapshot | null>
  isActiveOperator(userId: string): Promise<boolean>
  applyPromotion(args: {
    placeId: string
    kind: AttributeKind
    fromObservationId: string | null
    toObservationId: string
    actor: PromotionActor
  }): Promise<void>
  recordConflict(args: {
    placeId: string
    kind: AttributeKind
    currentObservationId: string | null
    proposedObservationId: string
  }): Promise<void>
}

export interface PromoteAttributeObservationInput {
  placeId: string
  kind: AttributeKind
  observationId: string
  actor: PromotionActor
}

export type PromoteAttributeObservationResult =
  | { status: 'promoted' }
  | { status: 'conflict'; reason: 'unattended_cannot_override_curated' }
  | { status: 'rejected'; reason: PromotionRejectReason }

/** Thrown for programmer/authorization errors (not ordinary business outcomes). */
export class PromoteAttributeObservationError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'observation_not_found'
      | 'observation_place_mismatch'
      | 'observation_kind_mismatch'
      | 'operator_not_authorized',
  ) {
    super(message)
    this.name = 'PromoteAttributeObservationError'
  }
}

export async function promoteAttributeObservation(
  input: PromoteAttributeObservationInput,
  port: PromoteAttributeObservationPort,
): Promise<PromoteAttributeObservationResult> {
  const observation = await port.loadObservation(input.observationId)
  if (!observation) {
    throw new PromoteAttributeObservationError('observation not found', 'observation_not_found')
  }
  if (observation.placeId !== input.placeId) {
    throw new PromoteAttributeObservationError(
      'observation belongs to a different place',
      'observation_place_mismatch',
    )
  }
  if (observation.kind !== input.kind) {
    throw new PromoteAttributeObservationError(
      'observation is for a different attribute kind',
      'observation_kind_mismatch',
    )
  }

  if (input.actor.kind === 'operator') {
    const authorized = await port.isActiveOperator(input.actor.operatorUserId)
    if (!authorized) {
      throw new PromoteAttributeObservationError(
        'actor is not an active operator',
        'operator_not_authorized',
      )
    }
  }

  const current = await port.loadCurrent(input.placeId, input.kind)
  const outcome = decidePromotion({
    hasCurrent: current !== null,
    currentProvenance: current?.provenanceKind ?? null,
    proposedProvenance: observation.provenanceKind,
    proposedLatestDecision: observation.latestDecision,
    actor: input.actor,
  })

  if (outcome.action === 'promote') {
    await port.applyPromotion({
      placeId: input.placeId,
      kind: input.kind,
      fromObservationId: current?.currentObservationId ?? null,
      toObservationId: input.observationId,
      actor: input.actor,
    })
    return { status: 'promoted' }
  }

  if (outcome.recordConflict) {
    await port.recordConflict({
      placeId: input.placeId,
      kind: input.kind,
      currentObservationId: current?.currentObservationId ?? null,
      proposedObservationId: input.observationId,
    })
    return { status: 'conflict', reason: 'unattended_cannot_override_curated' }
  }

  return { status: 'rejected', reason: outcome.reason }
}
