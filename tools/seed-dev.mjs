#!/usr/bin/env node
// LOCAL DEV FIXTURES ONLY. Inserts a handful of sample published (and one draft)
// Toronto cafés so the public read path can be exercised locally. Guarded to a
// local database — never run against Neon/production. This is the dev analogue
// of the Tier 2 fixtures; it is not GP-1 seeding and never runs on page load or
// in production. History is append-only, so this is insert-once: it skips if the
// sample data is already present (reset the local DB to re-seed).
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'

const url = process.env.DATABASE_URL
function assertLocal(connectionString) {
  if (!connectionString) {
    console.error('seed-dev: DATABASE_URL is not set — refusing to run.')
    process.exit(1)
  }
  let host
  try {
    host = new URL(connectionString).hostname
  } catch {
    console.error('seed-dev: DATABASE_URL is not a valid URL.')
    process.exit(1)
  }
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
    console.error(
      `seed-dev: refusing to seed non-local host "${host}". Dev fixtures are local-only.`,
    )
    process.exit(1)
  }
}
assertLocal(url)

const day = (opens, closes) => ({
  state: 'open',
  intervals: [{ opens, closes, closesDayOffset: 0 }],
})
function weekHours(open, close) {
  return {
    version: 1,
    timeZone: 'America/Toronto',
    days: {
      monday: day(open, close),
      tuesday: day(open, close),
      wednesday: day(open, close),
      thursday: day(open, close),
      friday: day(open, close),
      saturday: day('09:00', '18:00'),
      sunday: { state: 'closed' },
    },
  }
}

const CAFES = [
  {
    slug: 'dineen-coffee',
    name: 'Dineen Coffee Co.',
    address: '140 Yonge St',
    neighborhood: 'Financial District',
    lat: 43.6516,
    lng: -79.3792,
    publicationState: 'published',
    attributes: { wifi: 'usable', power: 'limited', noise: 'moderate', seating: 'adequate' },
    hours: weekHours('07:00', '19:00'),
  },
  {
    slug: 'boxcar-social-harbourfront',
    name: 'Boxcar Social',
    address: '235 Queens Quay W',
    neighborhood: 'Harbourfront',
    lat: 43.6389,
    lng: -79.3817,
    publicationState: 'published',
    attributes: { wifi: 'fast', power: 'available', noise: 'lively', seating: 'ample' },
    hours: weekHours('08:00', '23:00'),
  },
  {
    slug: 'sam-james-harbord',
    name: 'Sam James Coffee Bar',
    address: '297 Harbord St',
    neighborhood: 'Harbord Village',
    lat: 43.6595,
    lng: -79.4165,
    publicationState: 'published',
    // seating intentionally omitted → renders as Unknown (never a negative)
    attributes: { wifi: 'unreliable', power: 'none', noise: 'quiet' },
    hours: null,
  },
  {
    slug: 'balzacs-distillery',
    name: "Balzac's Coffee",
    address: '1 Trinity St',
    neighborhood: 'Distillery District',
    lat: 43.6503,
    lng: -79.3597,
    publicationState: 'published',
    attributes: { wifi: 'usable', noise: 'moderate', seating: 'limited' },
    hours: null,
  },
  {
    slug: 'draft-cafe-hidden',
    name: 'Draft Cafe (should not appear)',
    address: '1 Nowhere Ave',
    neighborhood: 'Nowhere',
    lat: 43.66,
    lng: -79.4,
    publicationState: 'draft',
    attributes: { wifi: 'fast' },
    hours: null,
  },
]

const pool = new Pool({ connectionString: url })
const client = await pool.connect()
try {
  const existing = await client.query('SELECT 1 FROM places WHERE slug = $1 LIMIT 1', [
    CAFES[0].slug,
  ])
  if (existing.rowCount && existing.rowCount > 0) {
    console.log('seed-dev: sample data already present — skipping (reset the local DB to re-seed).')
    process.exit(0)
  }

  await client.query('BEGIN')
  const operatorId = randomUUID()
  await client.query(
    `INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
     VALUES ($1, 'Dev Operator', $2, true, now(), now())`,
    [operatorId, `dev-${operatorId}@example.test`],
  )
  await client.query('INSERT INTO operators (user_id, active) VALUES ($1, true)', [operatorId])

  for (const cafe of CAFES) {
    const placeId = randomUUID()
    await client.query(
      `INSERT INTO places (id, slug, name, address, neighborhood, latitude, longitude, publication_state, record_state)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')`,
      [
        placeId,
        cafe.slug,
        cafe.name,
        cafe.address,
        cafe.neighborhood,
        cafe.lat,
        cafe.lng,
        cafe.publicationState,
      ],
    )
    for (const [kind, value] of Object.entries(cafe.attributes)) {
      const obsId = randomUUID()
      await client.query(
        `INSERT INTO attribute_observations (id, place_id, kind, value, provenance_kind, confidence, observed_at, observed_by_operator_user_id)
         VALUES ($1, $2, $3, $4, 'curator', 'medium', now(), $5)`,
        [obsId, placeId, kind, value, operatorId],
      )
      await client.query(
        `INSERT INTO attribute_observation_decisions (observation_id, decision, decided_by_operator_user_id)
         VALUES ($1, 'accepted', $2)`,
        [obsId, operatorId],
      )
      await client.query(
        'INSERT INTO place_attribute_current (place_id, kind, current_observation_id) VALUES ($1, $2, $3)',
        [placeId, kind, obsId],
      )
    }
    if (cafe.hours) {
      await client.query(
        `INSERT INTO place_hours (place_id, schedule, provenance_kind, confidence, verified_by_operator_user_id, verified_at)
         VALUES ($1, $2::jsonb, 'curator', 'medium', $3, now())`,
        [placeId, JSON.stringify(cafe.hours), operatorId],
      )
    }
  }
  await client.query('COMMIT')
  const published = CAFES.filter((c) => c.publicationState === 'published').length
  console.log(
    `seed-dev: inserted ${published} published + ${CAFES.length - published} draft café(s).`,
  )
} catch (err) {
  await client.query('ROLLBACK').catch(() => {})
  console.error('seed-dev: FAILED —', err instanceof Error ? err.message : err)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
