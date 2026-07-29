import { sql } from 'drizzle-orm'
import type { RecordObservationInput } from '@/lib/domain/attribute-observation-input'
import type { Db } from '../client'

// Operator-write data access for attribute evidence (Step 4 operator-curation
// slice). Observations and their review decisions are append-only history:
// recording curator evidence writes the immutable observation and the recording
// operator's `accepted` decision in one transaction. The current pointer is NOT
// written here — promotion stays with the attribute-promotion use case and its
// repository, the only approved pointer writer (Step 3B ruling 2).

/**
 * Insert a curator observation and the recording operator's `accepted` decision,
 * in one transaction. Returns the new observation id, or null when the place is
 * missing or not an active record (evidence is not recorded against closed or
 * duplicate records).
 */
export async function insertCuratorObservation(
  db: Db,
  values: RecordObservationInput,
  operatorUserId: string,
): Promise<{ observationId: string } | null> {
  return db.transaction(async (tx) => {
    const place = await tx.execute<{ id: string }>(sql`
      SELECT id FROM places WHERE id = ${values.placeId} AND record_state = 'active'
    `)
    if (place.rows.length === 0) return null
    const res = await tx.execute<{ id: string }>(sql`
      INSERT INTO attribute_observations
        (place_id, kind, value, provenance_kind, confidence, observed_at,
         observed_by_operator_user_id, note)
      VALUES (${values.placeId}, ${values.kind}, ${values.value}, 'curator',
              ${values.confidence}, ${values.observedAt}, ${operatorUserId}, ${values.note ?? null})
      RETURNING id
    `)
    const observationId = res.rows[0].id
    await tx.execute(sql`
      INSERT INTO attribute_observation_decisions (observation_id, decision, decided_by_operator_user_id)
      VALUES (${observationId}, 'accepted', ${operatorUserId})
    `)
    return { observationId }
  })
}
