import { describe, expect, it } from 'vitest'
import { decidePromotion, type PromotionActor } from '@/lib/domain/attribute-promotion'

const system: PromotionActor = { kind: 'system' }
const operator: PromotionActor = { kind: 'operator', operatorUserId: 'op-1' }

describe('decidePromotion (provenance precedence — pure rule)', () => {
  it('rejects a proposal whose latest decision is not accepted', () => {
    expect(
      decidePromotion({
        hasCurrent: false,
        currentProvenance: null,
        proposedProvenance: 'curator',
        proposedLatestDecision: null,
        actor: operator,
      }),
    ).toEqual({ action: 'reject', reason: 'observation_not_accepted', recordConflict: false })

    expect(
      decidePromotion({
        hasCurrent: false,
        currentProvenance: null,
        proposedProvenance: 'imported',
        proposedLatestDecision: 'rejected',
        actor: operator,
      }).action,
    ).toBe('reject')
  })

  it('#20 an authorized operator may promote an accepted imported observation over curated state', () => {
    expect(
      decidePromotion({
        hasCurrent: true,
        currentProvenance: 'curator',
        proposedProvenance: 'imported',
        proposedLatestDecision: 'accepted',
        actor: operator,
      }),
    ).toEqual({ action: 'promote' })
  })

  it('#19 an unattended import cannot overwrite curated/measured state — it creates review work', () => {
    for (const currentProvenance of ['curator', 'measurement'] as const) {
      expect(
        decidePromotion({
          hasCurrent: true,
          currentProvenance,
          proposedProvenance: 'imported',
          proposedLatestDecision: 'accepted',
          actor: system,
        }),
      ).toEqual({
        action: 'reject',
        reason: 'unattended_cannot_override_curated',
        recordConflict: true,
      })
    }
  })

  it('an unattended import may set a value when there is none or the current is itself an import', () => {
    expect(
      decidePromotion({
        hasCurrent: false,
        currentProvenance: null,
        proposedProvenance: 'imported',
        proposedLatestDecision: 'accepted',
        actor: system,
      }),
    ).toEqual({ action: 'promote' })

    expect(
      decidePromotion({
        hasCurrent: true,
        currentProvenance: 'imported',
        proposedProvenance: 'imported',
        proposedLatestDecision: 'accepted',
        actor: system,
      }),
    ).toEqual({ action: 'promote' })
  })
})
