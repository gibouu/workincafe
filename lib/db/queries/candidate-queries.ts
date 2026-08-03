import { sql } from 'drizzle-orm'
import type { CandidateStatus } from '@/lib/domain/candidates'
import type { Db } from '../client'

// GP-1 candidate read path (slice 2 pt.2). Queue order is FIFO by entry time:
// under the IDs-only boundary a pre-review candidate has no our-side features
// to rank on (we know only its Place ID), so there is deliberately no scoring
// here — ranking, if ever justified, is a future recorded decision over the
// captured decision labels.

export interface CandidateQueueRow {
  id: string
  googlePlaceId: string
  status: CandidateStatus
  enteredAt: string
  decisionCount: number
}

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value)
}

export async function selectReviewQueue(db: Db): Promise<CandidateQueueRow[]> {
  const res = await db.execute<{
    id: string
    google_place_id: string
    status: CandidateStatus
    entered_at: unknown
    decision_count: number
  }>(sql`
    SELECT c.id, c.google_place_id, c.status, c.entered_at,
      (SELECT count(*)::int FROM candidate_decisions d WHERE d.candidate_id = c.id) AS decision_count
    FROM gp1_candidates c
    WHERE c.status IN ('pending', 'deferred')
    ORDER BY c.entered_at ASC, c.id ASC
    LIMIT 200
  `)
  return res.rows.map((r) => ({
    id: r.id,
    googlePlaceId: r.google_place_id,
    status: r.status,
    enteredAt: toIso(r.entered_at),
    decisionCount: r.decision_count,
  }))
}

export interface CandidateRow {
  id: string
  googlePlaceId: string
  status: CandidateStatus
  enteredAt: string
  createdPlaceId: string | null
}

export async function selectCandidateById(db: Db, id: string): Promise<CandidateRow | null> {
  const res = await db.execute<{
    id: string
    google_place_id: string
    status: CandidateStatus
    entered_at: unknown
    created_place_id: string | null
  }>(sql`
    SELECT id, google_place_id, status, entered_at, created_place_id
    FROM gp1_candidates WHERE id = ${id}
  `)
  const row = res.rows[0]
  if (!row) return null
  return {
    id: row.id,
    googlePlaceId: row.google_place_id,
    status: row.status,
    enteredAt: toIso(row.entered_at),
    createdPlaceId: row.created_place_id,
  }
}

// Our-side match suggestions over the Overture staging index (Decision 9 —
// human-confirmed matching aided by name suggestions from OUR data). The
// operator-typed query is session-only; nothing here touches Google.
export interface OvertureSuggestionRow {
  gersId: string
  name: string
  primaryCategory: string | null
  address: string | null
  latitude: number
  longitude: number
  confidence: number | null
  alreadyLinkedPlaceId: string | null
}

export async function selectOvertureSuggestions(
  db: Db,
  nameQuery: string,
): Promise<OvertureSuggestionRow[]> {
  const res = await db.execute<{
    gers_id: string
    name: string
    primary_category: string | null
    address: string | null
    latitude: number
    longitude: number
    confidence: number | null
    already_linked_place_id: string | null
  }>(sql`
    SELECT o.gers_id, o.name, o.primary_category, o.address, o.latitude, o.longitude,
      o.confidence,
      (SELECT r.place_id FROM place_source_refs r
        WHERE r.source = 'overture' AND r.external_id = o.gers_id LIMIT 1) AS already_linked_place_id
    FROM overture_places o
    WHERE o.name ILIKE ${'%' + nameQuery + '%'}
    ORDER BY (o.name ILIKE ${nameQuery + '%'}) DESC, o.name ASC
    LIMIT 20
  `)
  return res.rows.map((r) => ({
    gersId: r.gers_id,
    name: r.name,
    primaryCategory: r.primary_category,
    address: r.address,
    latitude: r.latitude,
    longitude: r.longitude,
    confidence: r.confidence,
    alreadyLinkedPlaceId: r.already_linked_place_id,
  }))
}

/** Top of the review queue (same order as the GP-1 queue) + how many remain. */
export async function selectNextReviewable(
  db: Db,
): Promise<{ nextCandidateId: string | null; reviewableCount: number }> {
  const res = await db.execute<{ id: string; total: number }>(sql`
    SELECT id, count(*) OVER ()::int AS total
    FROM gp1_candidates
    WHERE status IN ('pending', 'deferred')
    ORDER BY entered_at ASC, id ASC
    LIMIT 1
  `)
  return {
    nextCandidateId: res.rows[0]?.id ?? null,
    reviewableCount: res.rows[0]?.total ?? 0,
  }
}
