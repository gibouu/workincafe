#!/usr/bin/env node
// Applies the committed migration chain (./drizzle) over a DIRECT connection
// (Decision 7 / Decision 20). Generation needs no database URL; execution
// requires DATABASE_URL_DIRECT and fails clearly without it. This is NOT
// `drizzle-kit push` and NOT Better Auth's direct migration command — it runs
// the reviewed, committed SQL files in journal order under an advisory lock (the
// Drizzle migrator no-ops already-applied migrations).
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

const url = process.env.DATABASE_URL_DIRECT
if (!url) {
  console.error(
    'db:migrate: DATABASE_URL_DIRECT is not set — refusing to run.\n' +
      '  Set DATABASE_URL_DIRECT to a direct (non-pooled) PostgreSQL connection string.\n' +
      '  Generation (db:generate) needs no database; only execution does.',
  )
  process.exit(1)
}

const pool = new Pool({ connectionString: url })
try {
  const db = drizzle(pool)
  await migrate(db, { migrationsFolder: './drizzle' })
  console.log('db:migrate: OK — migration chain applied (already-applied migrations were no-ops).')
} catch (err) {
  console.error('db:migrate: FAILED')
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
} finally {
  await pool.end()
}
