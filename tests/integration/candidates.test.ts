import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type { DbHandle } from '@/lib/db/client'
import { decideCandidate } from '@/lib/application/candidates/decide-candidate'
import { insertCandidates } from '@/lib/db/queries/candidate-mutations'
import { ingestOvertureExtract } from '@/lib/ingestion/overture-index'
import { captureError, insertOperator, insertUser, openTestDb } from './helpers'

// Slice 2 pt.2: the GP-1 candidate lifecycle end-to-end — queue intake dedup,
// append-only reason-coded decisions with server-built feature snapshots,
// status projection, approval creating the draft café + source refs + curation
// event in one transaction, and the STRUCTURAL IDs-only boundary (the candidate
// tables have no column that could hold Google content).

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

async function insertRun(): Promise<string> {
  const id = randomUUID()
  await handle.db.execute(sql`
    INSERT INTO seeding_runs (id, initiated_by_operator_user_id, query_template_id, status)
    VALUES (${id}, ${operatorId}, 'test-template', 'completed')
  `)
  return id
}

async function queueOne(placeId = `gpid-${randomUUID().slice(0, 12)}`): Promise<{
  candidateId: string
  googlePlaceId: string
}> {
  const runId = await insertRun()
  await insertCandidates(handle.db, runId, [placeId])
  const res = await handle.db.execute<{ id: string }>(
    sql`SELECT id FROM gp1_candidates WHERE google_place_id = ${placeId}`,
  )
  return { candidateId: res.rows[0].id, googlePlaceId: placeId }
}

async function seedOverture(name: string): Promise<string> {
  const gersId = `gers-${randomUUID().slice(0, 12)}`
  await ingestOvertureExtract(
    handle.db,
    [
      JSON.stringify({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-79.39, 43.66] },
        properties: {
          id: gersId,
          names: { primary: name },
          categories: { primary: 'coffee_shop' },
          websites: ['https://cafe.test'],
          confidence: 0.88,
        },
      }),
    ],
    { sourceVersion: 'cand-test' },
  )
  return gersId
}

describe('candidate queue intake', () => {
  it('dedups by Google Place ID across runs', async () => {
    const runA = await insertRun()
    const runB = await insertRun()
    const placeId = `gpid-${randomUUID().slice(0, 12)}`
    expect(await insertCandidates(handle.db, runA, [placeId, placeId])).toEqual({ inserted: 1 })
    expect(await insertCandidates(handle.db, runB, [placeId])).toEqual({ inserted: 0 })
  })
})

describe('decideCandidate (transactional)', () => {
  it('rejects with a reason: appends the decision + snapshot and projects status', async () => {
    const { candidateId } = await queueOne()
    const result = await decideCandidate(
      { candidateId, decision: 'rejected', reasonCode: 'chain', note: 'big chain' },
      operatorId,
      handle.db,
    )
    expect(result).toEqual({ status: 'decided', createdPlaceId: null, createdSlug: null })

    const decision = await handle.db.execute<{
      decision: string
      reason_code: string
      features: { version: number; portable: { overtureMatch: { matched: boolean } } }
      feature_set_version: number
    }>(sql`
      SELECT decision, reason_code, features, feature_set_version
      FROM candidate_decisions WHERE candidate_id = ${candidateId}
    `)
    expect(decision.rows).toHaveLength(1)
    expect(decision.rows[0].decision).toBe('rejected')
    expect(decision.rows[0].reason_code).toBe('chain')
    expect(decision.rows[0].feature_set_version).toBe(1)
    expect(decision.rows[0].features.portable.overtureMatch.matched).toBe(false)

    const status = await handle.db.execute<{ status: string }>(
      sql`SELECT status FROM gp1_candidates WHERE id = ${candidateId}`,
    )
    expect(status.rows[0].status).toBe('rejected')
  })

  it('defer keeps the candidate reviewable; a later decision supersedes', async () => {
    const { candidateId } = await queueOne()
    await decideCandidate(
      { candidateId, decision: 'deferred', note: 'revisit' },
      operatorId,
      handle.db,
    )
    const second = await decideCandidate(
      { candidateId, decision: 'rejected', reasonCode: 'permanently_closed' },
      operatorId,
      handle.db,
    )
    expect(second.status).toBe('decided')
    const rows = await handle.db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM candidate_decisions WHERE candidate_id = ${candidateId}`,
    )
    expect(rows.rows[0].n).toBe(2)
  })

  it('a finalized candidate is not reviewable again', async () => {
    const { candidateId } = await queueOne()
    await decideCandidate(
      { candidateId, decision: 'rejected', reasonCode: 'not_a_cafe' },
      operatorId,
      handle.db,
    )
    const again = await decideCandidate(
      { candidateId, decision: 'deferred' },
      operatorId,
      handle.db,
    )
    expect(again).toEqual({ status: 'not_reviewable' })
  })

  it('approval with an Overture match creates the draft café, source refs, and event', async () => {
    const { candidateId, googlePlaceId } = await queueOne()
    const gersId = await seedOverture('Approve Match Cafe')
    const slug = `approve-${randomUUID().slice(0, 8)}`

    const result = await decideCandidate(
      {
        candidateId,
        decision: 'approved',
        matchedGersId: gersId,
        name: 'Approve Match Cafe',
        slug,
      },
      operatorId,
      handle.db,
    )
    expect(result.status).toBe('decided')
    if (result.status !== 'decided') return
    expect(result.createdPlaceId).not.toBeNull()

    const place = await handle.db.execute<{
      name: string
      publication_state: string
      website: string
      latitude: number
    }>(sql`
      SELECT name, publication_state, website, latitude FROM places WHERE id = ${result.createdPlaceId}
    `)
    expect(place.rows[0].name).toBe('Approve Match Cafe')
    expect(place.rows[0].publication_state).toBe('draft')
    expect(place.rows[0].website).toBe('https://cafe.test')
    expect(place.rows[0].latitude).toBeCloseTo(43.66)

    const refs = await handle.db.execute<{ source: string; external_id: string }>(sql`
      SELECT source, external_id FROM place_source_refs
      WHERE place_id = ${result.createdPlaceId} ORDER BY source
    `)
    expect(refs.rows).toEqual([
      { source: 'google_places', external_id: googlePlaceId },
      { source: 'overture', external_id: gersId },
    ])

    const events = await handle.db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM curation_events
      WHERE place_id = ${result.createdPlaceId} AND event_type = 'place_created'
    `)
    expect(events.rows[0].n).toBe(1)

    const cand = await handle.db.execute<{ status: string; created_place_id: string }>(
      sql`SELECT status, created_place_id FROM gp1_candidates WHERE id = ${candidateId}`,
    )
    expect(cand.rows[0]).toEqual({ status: 'approved', created_place_id: result.createdPlaceId })

    const features = await handle.db.execute<{
      features: {
        portable: { overtureMatch: { matched: boolean; primaryCategory: string } }
        local: { insideServiceArea: boolean | null }
      }
    }>(sql`SELECT features FROM candidate_decisions WHERE candidate_id = ${candidateId}`)
    expect(features.rows[0].features.portable.overtureMatch.matched).toBe(true)
    expect(features.rows[0].features.portable.overtureMatch.primaryCategory).toBe('coffee_shop')
  })

  it('approval without a match uses operator-entered coordinates (google ref only)', async () => {
    const { candidateId } = await queueOne()
    const slug = `manual-${randomUUID().slice(0, 8)}`
    const result = await decideCandidate(
      {
        candidateId,
        decision: 'approved',
        name: 'Manual Entry Cafe',
        slug,
        latitude: '43.7',
        longitude: '-79.4',
      },
      operatorId,
      handle.db,
    )
    expect(result.status).toBe('decided')
    if (result.status !== 'decided') return
    const refs = await handle.db.execute<{ source: string }>(
      sql`SELECT source FROM place_source_refs WHERE place_id = ${result.createdPlaceId}`,
    )
    expect(refs.rows).toEqual([{ source: 'google_places' }])
  })

  it('a slug collision rolls the whole decision back', async () => {
    const { candidateId } = await queueOne()
    const gersId = await seedOverture('Collision Cafe')
    const slug = `collide-${randomUUID().slice(0, 8)}`
    const first = await queueOne()
    const firstGers = await seedOverture('Collision Cafe Original')
    await decideCandidate(
      {
        candidateId: first.candidateId,
        decision: 'approved',
        matchedGersId: firstGers,
        name: 'Collision Cafe Original',
        slug,
      },
      operatorId,
      handle.db,
    )

    const result = await decideCandidate(
      { candidateId, decision: 'approved', matchedGersId: gersId, name: 'Collision Cafe', slug },
      operatorId,
      handle.db,
    )
    expect(result).toEqual({ status: 'slug_taken' })
    const cand = await handle.db.execute<{ status: string }>(
      sql`SELECT status FROM gp1_candidates WHERE id = ${candidateId}`,
    )
    expect(cand.rows[0].status).toBe('pending')
    const decisions = await handle.db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM candidate_decisions WHERE candidate_id = ${candidateId}`,
    )
    expect(decisions.rows[0].n).toBe(0)
  })

  it('an Overture record already linked to a café is reported, not double-linked', async () => {
    const a = await queueOne()
    const gersId = await seedOverture('Linked Once Cafe')
    await decideCandidate(
      {
        candidateId: a.candidateId,
        decision: 'approved',
        matchedGersId: gersId,
        name: 'Linked Once Cafe',
        slug: `linked-${randomUUID().slice(0, 8)}`,
      },
      operatorId,
      handle.db,
    )
    const b = await queueOne()
    const result = await decideCandidate(
      {
        candidateId: b.candidateId,
        decision: 'approved',
        matchedGersId: gersId,
        name: 'Linked Twice Cafe',
        slug: `linked2-${randomUUID().slice(0, 8)}`,
      },
      operatorId,
      handle.db,
    )
    expect(result).toEqual({ status: 'overture_already_linked' })
  })
})

describe('structural boundaries', () => {
  it('candidate decisions are append-only at the database', async () => {
    const { candidateId } = await queueOne()
    await decideCandidate(
      { candidateId, decision: 'rejected', reasonCode: 'not_a_cafe' },
      operatorId,
      handle.db,
    )
    const upd = await captureError(() =>
      handle.db.execute(
        sql`UPDATE candidate_decisions SET note = 'edited' WHERE candidate_id = ${candidateId}`,
      ),
    )
    expect(upd.code).toBe('23001')
    const del = await captureError(() =>
      handle.db.execute(sql`DELETE FROM candidate_decisions WHERE candidate_id = ${candidateId}`),
    )
    expect(del.code).toBe('23001')
  })

  it('gp1_candidates has NO storage path for Google content beyond the Place ID', async () => {
    const res = await handle.db.execute<{ column_name: string }>(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'gp1_candidates'
      ORDER BY column_name
    `)
    expect(res.rows.map((r) => r.column_name)).toEqual([
      'created_place_id',
      'entered_at',
      'google_place_id',
      'id',
      'seeding_run_id',
      'status',
    ])
  })
})
