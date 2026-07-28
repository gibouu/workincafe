import { sql } from 'drizzle-orm'
import type { AttributeKind } from '@/lib/domain/attributes'
import { parseCurationEventDetails } from '@/lib/domain/curation'
import type { ObservationDecision, ProvenanceKind } from '@/lib/domain/provenance'
import type {
  PromoteAttributeObservationPort,
  ProposedObservationSnapshot,
  CurrentPointerSnapshot,
} from '@/lib/application/attributes/promote-attribute-observation'
import type { Db } from '../client'

// The single approved implementation of the attribute-promotion port
// (Step 3B ruling 2). It is the only code that writes `place_attribute_current`.
// Effects run in one transaction: the current-pointer upsert and the curation
// event are recorded together, so the projection and its audit trail cannot
// diverge. Provenance-precedence logic itself is in the use case/domain; this
// layer only performs validated database effects.

export function createAttributePromotionRepository(db: Db): PromoteAttributeObservationPort {
  return {
    async loadObservation(observationId: string): Promise<ProposedObservationSnapshot | null> {
      const res = await db.execute<{
        place_id: string
        kind: AttributeKind
        provenance_kind: ProvenanceKind
        latest_decision: ObservationDecision | null
      }>(sql`
        SELECT o.place_id, o.kind, o.provenance_kind,
          (
            SELECT d.decision
            FROM attribute_observation_decisions d
            WHERE d.observation_id = o.id
            ORDER BY d.seq DESC
            LIMIT 1
          ) AS latest_decision
        FROM attribute_observations o
        WHERE o.id = ${observationId}
      `)
      const row = res.rows[0]
      if (!row) return null
      return {
        observationId,
        placeId: row.place_id,
        kind: row.kind,
        provenanceKind: row.provenance_kind,
        latestDecision: row.latest_decision,
      }
    },

    async loadCurrent(
      placeId: string,
      kind: AttributeKind,
    ): Promise<CurrentPointerSnapshot | null> {
      const res = await db.execute<{
        current_observation_id: string
        provenance_kind: ProvenanceKind
      }>(sql`
        SELECT c.current_observation_id, o.provenance_kind
        FROM place_attribute_current c
        JOIN attribute_observations o ON o.id = c.current_observation_id
        WHERE c.place_id = ${placeId} AND c.kind = ${kind}
      `)
      const row = res.rows[0]
      if (!row) return null
      return {
        currentObservationId: row.current_observation_id,
        provenanceKind: row.provenance_kind,
      }
    },

    async isActiveOperator(userId: string): Promise<boolean> {
      const res = await db.execute<{ active: boolean }>(sql`
        SELECT active FROM operators WHERE user_id = ${userId}
      `)
      return res.rows[0]?.active === true
    },

    async applyPromotion(args): Promise<void> {
      const details = parseCurationEventDetails('attribute_promoted', {
        kind: args.kind,
        fromObservationId: args.fromObservationId,
        toObservationId: args.toObservationId,
      })
      const actorKind = args.actor.kind
      const actorUserId = args.actor.kind === 'operator' ? args.actor.operatorUserId : null
      const detailsJson = JSON.stringify(details)
      await db.transaction(async (tx) => {
        await tx.execute(sql`
          INSERT INTO place_attribute_current (place_id, kind, current_observation_id, updated_at)
          VALUES (${args.placeId}, ${args.kind}, ${args.toObservationId}, now())
          ON CONFLICT (place_id, kind)
          DO UPDATE SET current_observation_id = EXCLUDED.current_observation_id, updated_at = now()
        `)
        await tx.execute(sql`
          INSERT INTO curation_events (event_type, place_id, actor_kind, actor_user_id, details)
          VALUES ('attribute_promoted', ${args.placeId}, ${actorKind}, ${actorUserId}, ${detailsJson}::jsonb)
        `)
      })
    },

    async recordConflict(args): Promise<void> {
      const details = parseCurationEventDetails('attribute_conflict_detected', {
        kind: args.kind,
        currentObservationId: args.currentObservationId,
        proposedObservationId: args.proposedObservationId,
      })
      const detailsJson = JSON.stringify(details)
      await db.execute(sql`
        INSERT INTO curation_events (event_type, place_id, actor_kind, actor_user_id, details)
        VALUES ('attribute_conflict_detected', ${args.placeId}, 'system', NULL, ${detailsJson}::jsonb)
      `)
    },
  }
}
