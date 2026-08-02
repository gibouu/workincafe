import { sql } from 'drizzle-orm'
import type { SetCafeHoursInput } from '@/lib/domain/hours-input'
import type { Db } from '../client'

// Operator-write data access for the canonical hours record (Step 4
// operator-curation slice). `place_hours` is one current row per place — an
// upsert, not an append-only stream — so each save is paired with its
// append-only `hours_updated` curation event in one transaction, the same
// invariant the places and attribute-promotion writes uphold.

export type UpsertCafeHoursResult = 'saved' | 'not_found' | 'osm_ref_conflict'

/**
 * Upsert the café's hours and log `hours_updated`, in one transaction.
 *
 * Plain save: curator provenance, observed + verified now by the operator; any
 * prior import source reference is cleared. OSM-applied save (Decision 29):
 * `imported` provenance with an `osm` source reference (`node/<id>`/`way/<id>`),
 * `observed_at` = the OSM element's last edit, still verified by the operator —
 * the record stays honestly OSM-derived even when the operator corrected it
 * before saving. Returns `not_found` when the place is missing or inactive, and
 * `osm_ref_conflict` when the OSM element is already linked to another café.
 */
export async function upsertCafeHours(
  db: Db,
  values: SetCafeHoursInput,
  operatorUserId: string,
): Promise<UpsertCafeHoursResult> {
  const scheduleJson = JSON.stringify(values.schedule)
  const osm = values.osmSource ?? null
  const externalId = osm ? `${osm.osmType}/${osm.osmId}` : null
  return db.transaction(async (tx) => {
    let sourceRefId: string | null = null
    if (externalId) {
      // One OSM element identifies one venue: the (source, external_id) unique
      // key means an element already linked to a different place conflicts
      // instead of being silently re-attached.
      const existing = await tx.execute<{ id: string; place_id: string }>(sql`
        SELECT id, place_id FROM place_source_refs
        WHERE source = 'osm' AND external_id = ${externalId}
      `)
      const row = existing.rows[0]
      if (row && row.place_id !== values.placeId) return 'osm_ref_conflict'
      if (row) {
        await tx.execute(sql`
          UPDATE place_source_refs SET last_seen_at = now() WHERE id = ${row.id}
        `)
        sourceRefId = row.id
      } else {
        const inserted = await tx.execute<{ id: string }>(sql`
          INSERT INTO place_source_refs (place_id, source, external_id)
          SELECT p.id, 'osm', ${externalId}
          FROM places p
          WHERE p.id = ${values.placeId} AND p.record_state = 'active'
          RETURNING id
        `)
        if (inserted.rows.length === 0) return 'not_found'
        sourceRefId = inserted.rows[0].id
      }
    }

    const provenance = osm ? 'imported' : 'curator'
    const observedAt = osm ? (osm.observedAt ?? null) : sql`now()`
    const res = await tx.execute<{ place_id: string }>(sql`
      INSERT INTO place_hours
        (place_id, schedule, provenance_kind, source_ref_id, confidence,
         observed_at, verified_at, verified_by_operator_user_id, updated_at)
      SELECT p.id, ${scheduleJson}::jsonb, ${provenance}, ${sourceRefId}::uuid, ${values.confidence},
             ${observedAt}, now(), ${operatorUserId}, now()
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
    if (res.rows.length === 0) return 'not_found'
    const details = osm ? JSON.stringify({ source: 'osm', externalId }) : '{}'
    await tx.execute(sql`
      INSERT INTO curation_events (event_type, place_id, actor_kind, actor_user_id, details)
      VALUES ('hours_updated', ${values.placeId}, 'operator', ${operatorUserId}, ${details}::jsonb)
    `)
    return 'saved'
  })
}
