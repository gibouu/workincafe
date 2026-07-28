import { sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { createDb } from '../../lib/db/client'
import { assertDisposableLocalDb } from '../../lib/db/testing/local-guard'

// Vitest global setup for Tier 2 (Decision 22). Proves migrate-from-empty
// (test #1): drops the public + drizzle schemas to a truly empty database, then
// applies the committed migration chain. The production-URL guard (test #28)
// refuses any non-local target before we run destructive DDL.
export default async function setup(): Promise<void> {
  const url = assertDisposableLocalDb(process.env.DATABASE_URL_TEST)
  const { db, pool } = createDb(url)
  try {
    await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`)
    await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`)
    await db.execute(sql`CREATE SCHEMA public`)
    await migrate(db, { migrationsFolder: './drizzle' })
  } finally {
    await pool.end()
  }
}
