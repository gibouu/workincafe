import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { createDb, type Db, type DbHandle } from '@/lib/db/client'
import { assertDisposableLocalDb } from '@/lib/db/testing/local-guard'
import type { AttributeKind, AttributeValue } from '@/lib/domain/attributes'
import type { ConfidenceLevel, ObservationDecision, ProvenanceKind } from '@/lib/domain/provenance'

export function openTestDb(): DbHandle {
  return createDb(assertDisposableLocalDb(process.env.DATABASE_URL_TEST))
}

/** Run `fn`, returning the thrown error's SQLSTATE code + message, or failing if
 * nothing was thrown. Drizzle wraps driver errors, so the pg error (SQLSTATE +
 * real message) is unwrapped from `cause`. */
export async function captureError(
  fn: () => Promise<unknown>,
): Promise<{ code?: string; message: string }> {
  try {
    await fn()
  } catch (e) {
    const err = e as {
      code?: string
      message?: string
      cause?: { code?: string; message?: string }
    }
    return {
      code: err.code ?? err.cause?.code,
      message: String(err.cause?.message ?? err.message ?? e),
    }
  }
  throw new Error('expected the operation to throw, but it succeeded')
}

export async function insertUser(db: Db): Promise<string> {
  const id = randomUUID()
  await db.execute(sql`
    INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
    VALUES (${id}, 'Test Operator', ${`${id}@example.test`}, true, now(), now())
  `)
  return id
}

export async function insertOperator(db: Db, userId: string, active = true): Promise<void> {
  await db.execute(sql`INSERT INTO operators (user_id, active) VALUES (${userId}, ${active})`)
}

export async function insertPlace(
  db: Db,
  opts: {
    latitude?: number
    longitude?: number
    publicationState?: string
    recordState?: string
  } = {},
): Promise<string> {
  const id = randomUUID()
  const slug = `p-${id.slice(0, 8)}`
  await db.execute(sql`
    INSERT INTO places (id, slug, name, latitude, longitude, publication_state, record_state)
    VALUES (${id}, ${slug}, 'Test Cafe', ${opts.latitude ?? 43.6532}, ${opts.longitude ?? -79.3832},
            ${opts.publicationState ?? 'draft'}, ${opts.recordState ?? 'active'})
  `)
  return id
}

export async function insertSourceRef(
  db: Db,
  placeId: string,
  source = 'overture',
): Promise<string> {
  const id = randomUUID()
  await db.execute(sql`
    INSERT INTO place_source_refs (id, place_id, source, external_id)
    VALUES (${id}, ${placeId}, ${source}, ${randomUUID()})
  `)
  return id
}

// Auto-provisions the identity the new provenance CHECKs require: imported
// observations get a source reference; curator/measurement observations get an
// operator identity — unless the caller supplies one explicitly.
export async function insertObservation(
  db: Db,
  opts: {
    placeId: string
    kind: AttributeKind
    value: AttributeValue
    provenanceKind: ProvenanceKind
    confidence?: ConfidenceLevel
    observedByOperatorUserId?: string | null
    sourceRefId?: string | null
  },
): Promise<string> {
  const id = randomUUID()
  let sourceRefId = opts.sourceRefId ?? null
  let operatorUserId = opts.observedByOperatorUserId ?? null
  if (opts.provenanceKind === 'imported' && sourceRefId === null) {
    sourceRefId = await insertSourceRef(db, opts.placeId)
  }
  if (opts.provenanceKind !== 'imported' && operatorUserId === null) {
    operatorUserId = await insertUser(db)
  }
  await db.execute(sql`
    INSERT INTO attribute_observations
      (id, place_id, kind, value, provenance_kind, confidence, observed_at, observed_by_operator_user_id, source_ref_id)
    VALUES (${id}, ${opts.placeId}, ${opts.kind}, ${opts.value}, ${opts.provenanceKind},
            ${opts.confidence ?? 'medium'}, now(), ${operatorUserId}, ${sourceRefId})
  `)
  return id
}

export async function insertDecision(
  db: Db,
  opts: {
    observationId: string
    decision: ObservationDecision
    decidedBy: string
    decidedAt?: string
  },
): Promise<string> {
  const id = randomUUID()
  const decidedAt = opts.decidedAt ? sql`${opts.decidedAt}::timestamptz` : sql`now()`
  await db.execute(sql`
    INSERT INTO attribute_observation_decisions
      (id, observation_id, decision, decided_by_operator_user_id, decided_at)
    VALUES (${id}, ${opts.observationId}, ${opts.decision}, ${opts.decidedBy}, ${decidedAt})
  `)
  return id
}

/** Direct current-pointer write, bypassing the use case — exercises the database
 * cross-table constraint trigger directly. Accepts a tx via the `db` argument. */
export async function setCurrentDirect(
  db: Db,
  placeId: string,
  kind: AttributeKind,
  observationId: string,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO place_attribute_current (place_id, kind, current_observation_id)
    VALUES (${placeId}, ${kind}, ${observationId})
    ON CONFLICT (place_id, kind)
    DO UPDATE SET current_observation_id = EXCLUDED.current_observation_id, updated_at = now()
  `)
}

/** Convenience: an accepted observation of the given provenance, set as current. */
export async function seedAcceptedCurrent(
  db: Db,
  opts: {
    placeId: string
    kind: AttributeKind
    value: AttributeValue
    provenanceKind: ProvenanceKind
    operatorUserId: string
  },
): Promise<string> {
  const obsId = await insertObservation(db, {
    ...opts,
    // for curator/measurement, use the operator as observer to keep the graph tidy
    observedByOperatorUserId: opts.provenanceKind === 'imported' ? null : opts.operatorUserId,
  })
  await insertDecision(db, {
    observationId: obsId,
    decision: 'accepted',
    decidedBy: opts.operatorUserId,
  })
  await setCurrentDirect(db, opts.placeId, opts.kind, obsId)
  return obsId
}
