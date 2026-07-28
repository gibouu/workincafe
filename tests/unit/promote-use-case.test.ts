import { describe, expect, it, vi } from 'vitest'
import {
  PromoteAttributeObservationError,
  promoteAttributeObservation,
  type PromoteAttributeObservationPort,
  type ProposedObservationSnapshot,
} from '@/lib/application/attributes/promote-attribute-observation'

function makePort(
  overrides: Partial<PromoteAttributeObservationPort> = {},
): PromoteAttributeObservationPort {
  return {
    loadObservation: vi.fn(async () => null),
    loadCurrent: vi.fn(async () => null),
    isActiveOperator: vi.fn(async () => true),
    applyPromotion: vi.fn(async () => {}),
    recordConflict: vi.fn(async () => {}),
    ...overrides,
  }
}

const proposed = (
  over: Partial<ProposedObservationSnapshot> = {},
): ProposedObservationSnapshot => ({
  observationId: 'obs-1',
  placeId: 'place-1',
  kind: 'wifi',
  provenanceKind: 'imported',
  latestDecision: 'accepted',
  ...over,
})

describe('promoteAttributeObservation (use case)', () => {
  it('#20 an active operator promoting an accepted import applies the promotion', async () => {
    const port = makePort({ loadObservation: vi.fn(async () => proposed()) })
    const result = await promoteAttributeObservation(
      {
        placeId: 'place-1',
        kind: 'wifi',
        observationId: 'obs-1',
        actor: { kind: 'operator', operatorUserId: 'op-1' },
      },
      port,
    )
    expect(result).toEqual({ status: 'promoted' })
    expect(port.applyPromotion).toHaveBeenCalledOnce()
    expect(port.recordConflict).not.toHaveBeenCalled()
  })

  it('#19 an unattended import over curated state records a conflict, no promotion', async () => {
    const port = makePort({
      loadObservation: vi.fn(async () => proposed()),
      loadCurrent: vi.fn(async () => ({
        currentObservationId: 'cur-1',
        provenanceKind: 'curator' as const,
      })),
    })
    const result = await promoteAttributeObservation(
      { placeId: 'place-1', kind: 'wifi', observationId: 'obs-1', actor: { kind: 'system' } },
      port,
    )
    expect(result).toEqual({ status: 'conflict', reason: 'unattended_cannot_override_curated' })
    expect(port.recordConflict).toHaveBeenCalledOnce()
    expect(port.applyPromotion).not.toHaveBeenCalled()
  })

  it('throws when the observation does not exist', async () => {
    const port = makePort({ loadObservation: vi.fn(async () => null) })
    await expect(
      promoteAttributeObservation(
        { placeId: 'place-1', kind: 'wifi', observationId: 'missing', actor: { kind: 'system' } },
        port,
      ),
    ).rejects.toMatchObject({ code: 'observation_not_found' })
  })

  it('throws on place or kind mismatch', async () => {
    const wrongPlace = makePort({
      loadObservation: vi.fn(async () => proposed({ placeId: 'other' })),
    })
    await expect(
      promoteAttributeObservation(
        { placeId: 'place-1', kind: 'wifi', observationId: 'obs-1', actor: { kind: 'system' } },
        wrongPlace,
      ),
    ).rejects.toBeInstanceOf(PromoteAttributeObservationError)

    const wrongKind = makePort({ loadObservation: vi.fn(async () => proposed({ kind: 'noise' })) })
    await expect(
      promoteAttributeObservation(
        { placeId: 'place-1', kind: 'wifi', observationId: 'obs-1', actor: { kind: 'system' } },
        wrongKind,
      ),
    ).rejects.toMatchObject({ code: 'observation_kind_mismatch' })
  })

  it('throws when the operator is not active', async () => {
    const port = makePort({
      loadObservation: vi.fn(async () => proposed()),
      isActiveOperator: vi.fn(async () => false),
    })
    await expect(
      promoteAttributeObservation(
        {
          placeId: 'place-1',
          kind: 'wifi',
          observationId: 'obs-1',
          actor: { kind: 'operator', operatorUserId: 'nope' },
        },
        port,
      ),
    ).rejects.toMatchObject({ code: 'operator_not_authorized' })
    expect(port.applyPromotion).not.toHaveBeenCalled()
  })
})
