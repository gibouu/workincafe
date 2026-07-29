#!/usr/bin/env node
// Applies the committed migration chain (./drizzle) over a DIRECT connection,
// under a PostgreSQL advisory lock (Decision 7 / Decision 20). Generation needs
// no database URL; execution requires DATABASE_URL_DIRECT and fails clearly
// without it. This is NOT `drizzle-kit push` and NOT Better Auth's direct
// migration command — it runs the reviewed, committed SQL files in journal order.
// The advisory lock serializes concurrent deploys (bounded wait; released on
// success and failure); already-applied migrations are no-ops.
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

const LOCK_KEY = 271828182 // fixed advisory-lock key for WorkinCafe migrations
const LOCK_WAIT_MS = 60_000
const LOCK_POLL_MS = 1_000

// DATABASE_URL_DIRECT is our name; DATABASE_URL_UNPOOLED is the Neon-Vercel
// integration's name for the same direct connection — accept either.
const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL_UNPOOLED
if (!url) {
  console.error(
    'db:migrate: no direct database URL set — refusing to run.\n' +
      '  Set DATABASE_URL_DIRECT (or DATABASE_URL_UNPOOLED) to a direct (non-pooled) connection string.\n' +
      '  Generation (db:generate) needs no database; only execution does.',
  )
  process.exit(1)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const pool = new Pool({ connectionString: url })
const lockClient = await pool.connect()
let locked = false
try {
  const startedAt = Date.now()
  while (Date.now() - startedAt < LOCK_WAIT_MS) {
    const res = await lockClient.query('SELECT pg_try_advisory_lock($1) AS ok', [LOCK_KEY])
    if (res.rows[0]?.ok === true) {
      locked = true
      break
    }
    await sleep(LOCK_POLL_MS)
  }
  if (!locked) {
    throw new Error(
      'timed out waiting for the migration advisory lock (another deploy may be migrating)',
    )
  }
  const db = drizzle(pool)
  await migrate(db, { migrationsFolder: './drizzle' })
  console.log(
    'db:migrate: OK — migration chain applied under advisory lock (already-applied migrations were no-ops).',
  )
} catch (err) {
  console.error('db:migrate: FAILED')
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
} finally {
  if (locked) {
    await lockClient.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {})
  }
  lockClient.release()
  await pool.end()
}
