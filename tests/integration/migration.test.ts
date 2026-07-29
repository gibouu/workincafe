import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { DbHandle } from '@/lib/db/client'
import { captureError, insertOperator, insertUser, openTestDb } from './helpers'

// Covers required tests #1, #2, #3, #23, #24, #25.
let handle: DbHandle
beforeAll(() => {
  handle = openTestDb()
})
afterAll(async () => {
  await handle.pool.end()
})

describe('migration baseline', () => {
  it('#1 migrated from empty: expected tables exist', async () => {
    const res = await handle.db.execute<{ table_name: string }>(sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `)
    const names = res.rows.map((r) => r.table_name)
    for (const t of [
      'places',
      'place_source_refs',
      'attribute_observations',
      'attribute_observation_decisions',
      'place_attribute_current',
      'place_hours',
      'service_areas',
      'overture_places',
      'seeding_runs',
      'seeding_run_attempts',
      'gp1_candidates',
      'candidate_decisions',
      'operators',
      'curation_events',
      'user',
      'session',
      'account',
      'verification',
    ]) {
      expect(names, `missing table ${t}`).toContain(t)
    }
  })

  it('#2 re-applying the migration is a safe no-op', async () => {
    const before = await handle.db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`,
    )
    await migrate(handle.db, { migrationsFolder: './drizzle' })
    const after = await handle.db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`,
    )
    expect(after.rows[0].n).toBe(before.rows[0].n)
  })

  it('#3 postgis extension is installed', async () => {
    const res = await handle.db.execute<{ extversion: string }>(
      sql`SELECT extversion FROM pg_extension WHERE extname = 'postgis'`,
    )
    expect(res.rows).toHaveLength(1)
    expect(res.rows[0].extversion).toMatch(/^3\./)
  })

  it('#23 Better Auth core schema is present with expected columns', async () => {
    const res = await handle.db.execute<{
      table_name: string
      column_name: string
      data_type: string
    }>(sql`
      SELECT table_name, column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name IN ('user','session','account','verification')
    `)
    const has = (t: string, c: string) =>
      res.rows.some((r) => r.table_name === t && r.column_name === c)
    // Generated-from-config expectations (email+password, sessions, accounts).
    expect(has('user', 'id')).toBe(true)
    expect(has('user', 'email')).toBe(true)
    expect(has('user', 'email_verified')).toBe(true)
    expect(has('session', 'token')).toBe(true)
    expect(has('session', 'user_id')).toBe(true)
    expect(has('account', 'password')).toBe(true)
    expect(has('verification', 'identifier')).toBe(true)
    // user.id is text (operators.user_id must match this exact type).
    const userId = res.rows.find((r) => r.table_name === 'user' && r.column_name === 'id')
    expect(userId?.data_type).toBe('text')
    // No plugin tables were generated.
    const tables = await handle.db.execute<{ table_name: string }>(sql`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    `)
    const names = tables.rows.map((r) => r.table_name)
    for (const forbidden of ['organization', 'member', 'team', 'passkey', 'twoFactor', 'jwks']) {
      expect(names).not.toContain(forbidden)
    }
  })

  it('#24 operators.user_id references the generated Better Auth user table', async () => {
    const fk = await handle.db.execute<{ foreign_table: string; foreign_column: string }>(sql`
      SELECT ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'operators' AND kcu.column_name = 'user_id'
    `)
    expect(fk.rows[0]?.foreign_table).toBe('user')
    expect(fk.rows[0]?.foreign_column).toBe('id')

    // An operators row referencing a non-existent user is rejected by the FK.
    const err = await captureError(() =>
      handle.db.execute(sql`INSERT INTO operators (user_id, active) VALUES ('no-such-user', true)`),
    )
    expect(err.code).toBe('23503') // foreign_key_violation

    // With a real user it succeeds.
    const userId = await insertUser(handle.db)
    await expect(insertOperator(handle.db, userId)).resolves.toBeUndefined()
  })

  it('#25 place_source_refs has no storage path for extra Google content', async () => {
    const res = await handle.db.execute<{ column_name: string }>(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'place_source_refs'
    `)
    const cols = res.rows.map((r) => r.column_name).sort()
    // Exactly the identity columns — no payload/metadata/json/name/address/etc.
    expect(cols).toEqual(
      ['external_id', 'first_seen_at', 'id', 'last_seen_at', 'place_id', 'source'].sort(),
    )
    // No jsonb column anywhere on the table.
    const jsonb = await handle.db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'place_source_refs' AND data_type = 'jsonb'
    `)
    expect(jsonb.rows[0].n).toBe(0)
  })
})
