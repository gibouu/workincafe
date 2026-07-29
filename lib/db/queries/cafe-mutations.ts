import { sql } from 'drizzle-orm'
import type { CreateCafeInput, PublicationTransition } from '@/lib/domain/cafe-input'
import type { Db } from '../client'

// Operator-write data access for the places lifecycle (Step 4 operator-write
// slice). Each mutation and its curation event are written in one transaction so
// the record and its append-only audit trail cannot diverge — the same
// invariant the attribute-promotion repository upholds. New records default to
// draft/active via the schema defaults; publication transitions are plain
// UPDATEs (places is not append-only) paired with a matching curation event.

/** Insert a draft, active café and log `place_created`. Returns the new id + slug. */
export async function insertCafe(
  db: Db,
  values: CreateCafeInput,
  actorUserId: string,
): Promise<{ id: string; slug: string }> {
  return db.transaction(async (tx) => {
    const res = await tx.execute<{ id: string; slug: string }>(sql`
      INSERT INTO places (slug, name, address, neighborhood, website, phone, latitude, longitude)
      VALUES (
        ${values.slug}, ${values.name}, ${values.address ?? null}, ${values.neighborhood ?? null},
        ${values.website ?? null}, ${values.phone ?? null}, ${values.latitude}, ${values.longitude}
      )
      RETURNING id, slug
    `)
    const row = res.rows[0]
    await tx.execute(sql`
      INSERT INTO curation_events (event_type, place_id, actor_kind, actor_user_id, details)
      VALUES ('place_created', ${row.id}, 'operator', ${actorUserId}, '{}'::jsonb)
    `)
    return { id: row.id, slug: row.slug }
  })
}

const TRANSITION_EVENT: Record<PublicationTransition, 'place_published' | 'place_hidden'> = {
  published: 'place_published',
  hidden: 'place_hidden',
}

/**
 * Move an active café to `target` publication state and log the matching event,
 * in one transaction. A no-op (record not active, missing, or already in the
 * target state) changes nothing and logs nothing. Returns whether a change was
 * applied. Publishing requires an active record (also a DB CHECK).
 */
export async function setCafePublicationState(
  db: Db,
  placeId: string,
  target: PublicationTransition,
  actorUserId: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const res = await tx.execute<{ id: string }>(sql`
      UPDATE places
      SET publication_state = ${target}, updated_at = now()
      WHERE id = ${placeId}
        AND record_state = 'active'
        AND publication_state IS DISTINCT FROM ${target}
      RETURNING id
    `)
    if (res.rows.length === 0) return false
    await tx.execute(sql`
      INSERT INTO curation_events (event_type, place_id, actor_kind, actor_user_id, details)
      VALUES (${TRANSITION_EVENT[target]}, ${placeId}, 'operator', ${actorUserId}, '{}'::jsonb)
    `)
    return true
  })
}
