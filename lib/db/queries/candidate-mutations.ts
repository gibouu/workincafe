import { sql } from 'drizzle-orm'
import {
  buildCandidateFeaturesV1,
  type CandidateDecisionInput,
  FEATURE_SET_VERSION,
} from '@/lib/domain/candidates'
import type { CreateCafeInput } from '@/lib/domain/cafe-input'
import type { Db } from '../client'
import { isUniqueViolation } from '../errors'
import { insertCafe } from './cafe-mutations'

// GP-1 candidate write path (slice 2 pt.2). One transaction per review
// decision: append the immutable reason-coded decision (with its server-built,
// non-Google feature snapshot), project the candidate status, and — on
// approval — create the draft café with its place_created curation event and
// source references (the Google Place ID, and the matched Overture GERS id
// when present). The IDs-only boundary holds by construction: the only Google
// value this module ever writes is the Place ID already on the candidate row.

/** Queue intake: insert place-id candidates, ignoring ones already queued. */
export async function insertCandidates(
  db: Db,
  runId: string,
  googlePlaceIds: readonly string[],
): Promise<{ inserted: number }> {
  if (googlePlaceIds.length === 0) return { inserted: 0 }
  const rows = googlePlaceIds.map((id) => sql`(${id}, ${runId})`)
  const res = await db.execute(sql`
    INSERT INTO gp1_candidates (google_place_id, seeding_run_id)
    VALUES ${sql.join(rows, sql`, `)}
    ON CONFLICT (google_place_id) DO NOTHING
    RETURNING id
  `)
  return { inserted: res.rows.length }
}

export type ApplyCandidateDecisionResult =
  | { status: 'decided'; createdPlaceId: string | null; createdSlug: string | null }
  | { status: 'not_reviewable' }
  | { status: 'match_not_found' }
  | { status: 'slug_taken' }
  | { status: 'overture_already_linked' }

type OvertureMatchRow = {
  name: string
  primary_category: string | null
  latitude: number
  longitude: number
  address: string | null
  website: string | null
  phone: string | null
  confidence: number | null
}

export async function applyCandidateDecision(
  db: Db,
  input: CandidateDecisionInput,
  actorUserId: string,
): Promise<ApplyCandidateDecisionResult> {
  try {
    return await db.transaction(async (tx) => {
      // Lock the candidate; only pending/deferred candidates are reviewable —
      // approved and rejected are final.
      const candidate = await tx.execute<{ id: string; google_place_id: string }>(sql`
        SELECT id, google_place_id FROM gp1_candidates
        WHERE id = ${input.candidateId} AND status IN ('pending', 'deferred')
        FOR UPDATE
      `)
      const candidateRow = candidate.rows[0]
      if (!candidateRow) return { status: 'not_reviewable' as const }

      let match: OvertureMatchRow | null = null
      if (input.matchedGersId) {
        const res = await tx.execute<OvertureMatchRow>(sql`
          SELECT name, primary_category, latitude, longitude, address, website, phone, confidence
          FROM overture_places WHERE gers_id = ${input.matchedGersId}
        `)
        match = res.rows[0] ?? null
        if (!match) return { status: 'match_not_found' as const }
      }

      // Service-area containment for the decision coordinates (matched record
      // first, manual entry second); null when there are no coordinates or no
      // imported service area.
      const latitude = match?.latitude ?? input.latitude
      const longitude = match?.longitude ?? input.longitude
      let insideServiceArea: boolean | null = null
      if (latitude !== undefined && longitude !== undefined) {
        const res = await tx.execute<{ inside: boolean | null }>(sql`
          SELECT bool_or(ST_Contains(geometry, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326))) AS inside
          FROM service_areas WHERE active = true
        `)
        insideServiceArea = res.rows[0]?.inside ?? null
      }

      const features = buildCandidateFeaturesV1({
        overtureMatch: match
          ? {
              primaryCategory: match.primary_category,
              confidence: match.confidence,
              website: match.website,
            }
          : null,
        insideServiceArea,
      })

      let createdPlaceId: string | null = null
      let createdSlug: string | null = null
      if (input.decision === 'approved') {
        // Domain validation guarantees name+slug and match-or-coordinates.
        const cafe: CreateCafeInput = {
          name: input.name as string,
          slug: input.slug as string,
          latitude: latitude as number,
          longitude: longitude as number,
          address: match?.address ?? undefined,
          website: match?.website ?? undefined,
          phone: match?.phone ?? undefined,
        }
        const created = await insertCafe(tx, cafe, actorUserId)
        createdPlaceId = created.id
        createdSlug = created.slug

        await tx.execute(sql`
          INSERT INTO place_source_refs (place_id, source, external_id)
          VALUES (${createdPlaceId}, 'google_places', ${candidateRow.google_place_id})
        `)
        if (input.matchedGersId) {
          await tx.execute(sql`
            INSERT INTO place_source_refs (place_id, source, external_id)
            VALUES (${createdPlaceId}, 'overture', ${input.matchedGersId})
          `)
        }
      }

      await tx.execute(sql`
        INSERT INTO candidate_decisions
          (candidate_id, decision, reason_code, note, matched_gers_id,
           decided_by_operator_user_id, features, feature_set_version)
        VALUES
          (${input.candidateId}, ${input.decision}, ${input.reasonCode ?? null},
           ${input.note ?? null}, ${input.matchedGersId ?? null}, ${actorUserId},
           ${JSON.stringify(features)}::jsonb, ${FEATURE_SET_VERSION})
      `)
      await tx.execute(sql`
        UPDATE gp1_candidates
        SET status = ${input.decision}, created_place_id = ${createdPlaceId}
        WHERE id = ${input.candidateId}
      `)

      return { status: 'decided' as const, createdPlaceId, createdSlug }
    })
  } catch (error) {
    if (isUniqueViolation(error, 'places_slug_key')) return { status: 'slug_taken' }
    if (isUniqueViolation(error, 'place_source_refs_source_external_key')) {
      return { status: 'overture_already_linked' }
    }
    throw error
  }
}
