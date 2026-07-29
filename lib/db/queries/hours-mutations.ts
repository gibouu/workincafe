import { sql } from 'drizzle-orm'
import type { SetCafeHoursInput } from '@/lib/domain/hours-input'
import type { Db } from '../client'

// Operator-write data access for the canonical hours record (Step 4
// operator-curation slice). `place_hours` is one current row per place — an
// upsert, not an append-only stream — so each save is paired with its
// append-only `hours_updated` curation event in one transaction, the same
// invariant the places and attribute-promotion writes uphold.

/**
 * Upsert the café's hours as curator-verified and log `hours_updated`, in one
 * transaction. Saving marks the schedule observed + verified now by the given
 * operator (curator provenance clears any prior import source reference).
 * Returns false when the place is missing or not an active record.
 */
export async function upsertCafeHours(
  db: Db,
  values: SetCafeHoursInput,
  operatorUserId: string,
): Promise<boolean> {
  const scheduleJson = JSON.stringify(values.schedule)
  return db.transaction(async (tx) => {
    const res = await tx.execute<{ place_id: string }>(sql`
      INSERT INTO place_hours
        (place_id, schedule, provenance_kind, source_ref_id, confidence,
         observed_at, verified_at, verified_by_operator_user_id, updated_at)
      SELECT p.id, ${scheduleJson}::jsonb, 'curator', NULL, ${values.confidence},
             now(), now(), ${operatorUserId}, now()
      FROM places p
      WHERE p.id = ${values.placeId} AND p.record_state = 'active'
      ON CONFLICT (place_id) DO UPDATE SET
        schedule = EXCLUDED.schedule,
        provenance_kind = EXCLUDED.provenance_kind,
        source_ref_id = EXCLUDED.source_ref_id,
        confidence = EXCLUDED.confidence,
        observed_at = EXCLUDED.observed_at,
        verified_at = EXCLUDED.verified_at,
        verified_by_operator_user_id = EXCLUDED.verified_by_operator_user_id,
        updated_at = EXCLUDED.updated_at
      RETURNING place_id
    `)
    if (res.rows.length === 0) return false
    await tx.execute(sql`
      INSERT INTO curation_events (event_type, place_id, actor_kind, actor_user_id, details)
      VALUES ('hours_updated', ${values.placeId}, 'operator', ${operatorUserId}, '{}'::jsonb)
    `)
    return true
  })
}
