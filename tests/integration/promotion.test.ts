import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { createAttributePromotionRepository } from '@/lib/db/repositories/attribute-promotion-repo'
import { promoteAttributeObservation } from '@/lib/application/attributes/promote-attribute-observation'
import type { DbHandle } from '@/lib/db/client'
import {
  insertDecision,
  insertObservation,
  insertOperator,
  insertPlace,
  insertUser,
  openTestDb,
  seedAcceptedCurrent,
} from './helpers'

// Covers required tests #19, #20 through the real use case + repository against
// the database, in transactions.
let handle: DbHandle
let operatorId: string
beforeAll(async () => {
  handle = openTestDb()
  operatorId = await insertUser(handle.db)
  await insertOperator(handle.db, operatorId, true)
})
afterAll(async () => {
  await handle.pool.end()
})

async function currentObservation(placeId: string, kind: string): Promise<string | null> {
  const res = await handle.db.execute<{ current_observation_id: string }>(sql`
    SELECT current_observation_id FROM place_attribute_current WHERE place_id = ${placeId} AND kind = ${kind}
  `)
  return res.rows[0]?.current_observation_id ?? null
}

async function countEvents(placeId: string, eventType: string): Promise<number> {
  const res = await handle.db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM curation_events WHERE place_id = ${placeId} AND event_type = ${eventType}
  `)
  return res.rows[0].n
}

describe('promoteAttributeObservation (transactional)', () => {
  it('#19 an unattended import cannot replace curated current state', async () => {
    const repo = createAttributePromotionRepository(handle.db)
    const placeId = await insertPlace(handle.db)
    const curated = await seedAcceptedCurrent(handle.db, {
      placeId,
      kind: 'wifi',
      value: 'fast',
      provenanceKind: 'curator',
      operatorUserId: operatorId,
    })
    // An accepted imported observation proposing a different value.
    const imported = await insertObservation(handle.db, {
      placeId,
      kind: 'wifi',
      value: 'usable',
      provenanceKind: 'imported',
    })
    await insertDecision(handle.db, {
      observationId: imported,
      decision: 'accepted',
      decidedBy: operatorId,
    })

    const result = await promoteAttributeObservation(
      { placeId, kind: 'wifi', observationId: imported, actor: { kind: 'system' } },
      repo,
    )

    expect(result).toEqual({ status: 'conflict', reason: 'unattended_cannot_override_curated' })
    // Current state is unchanged...
    expect(await currentObservation(placeId, 'wifi')).toBe(curated)
    // ...and a review-work conflict event was recorded, but no promotion event.
    expect(await countEvents(placeId, 'attribute_conflict_detected')).toBe(1)
    expect(await countEvents(placeId, 'attribute_promoted')).toBe(0)
  })

  it('#20 a deliberate authorized review can promote an imported observation', async () => {
    const repo = createAttributePromotionRepository(handle.db)
    const placeId = await insertPlace(handle.db)
    await seedAcceptedCurrent(handle.db, {
      placeId,
      kind: 'noise',
      value: 'lively',
      provenanceKind: 'curator',
      operatorUserId: operatorId,
    })
    const imported = await insertObservation(handle.db, {
      placeId,
      kind: 'noise',
      value: 'quiet',
      provenanceKind: 'imported',
    })
    await insertDecision(handle.db, {
      observationId: imported,
      decision: 'accepted',
      decidedBy: operatorId,
    })

    const result = await promoteAttributeObservation(
      {
        placeId,
        kind: 'noise',
        observationId: imported,
        actor: { kind: 'operator', operatorUserId: operatorId },
      },
      repo,
    )

    expect(result).toEqual({ status: 'promoted' })
    expect(await currentObservation(placeId, 'noise')).toBe(imported)
    expect(await countEvents(placeId, 'attribute_promoted')).toBe(1)
  })

  it('#19/#20 an unattended import may set an as-yet-unset value (no curated state to protect)', async () => {
    const repo = createAttributePromotionRepository(handle.db)
    const placeId = await insertPlace(handle.db)
    const imported = await insertObservation(handle.db, {
      placeId,
      kind: 'seating',
      value: 'adequate',
      provenanceKind: 'imported',
    })
    await insertDecision(handle.db, {
      observationId: imported,
      decision: 'accepted',
      decidedBy: operatorId,
    })
    const result = await promoteAttributeObservation(
      { placeId, kind: 'seating', observationId: imported, actor: { kind: 'system' } },
      repo,
    )
    expect(result).toEqual({ status: 'promoted' })
    expect(await currentObservation(placeId, 'seating')).toBe(imported)
  })
})
