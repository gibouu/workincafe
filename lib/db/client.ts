import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

// Server-only Drizzle client factory over the `pg` node-postgres driver
// (Decision 6). Kept as a factory so migration tooling and Tier 2 integration
// tests can each own a disposable pool; the long-lived one-pool-per-runtime
// application client arrives with the first product slice (Step 4). This module
// imports `pg`, so it can never be bundled for the browser; ESLint boundaries
// additionally forbid components/app from importing `@/lib/db/*`.

export type Db = NodePgDatabase

export interface DbHandle {
  db: Db
  pool: Pool
}

export function createDb(connectionString: string): DbHandle {
  const pool = new Pool({ connectionString })
  const db = drizzle(pool)
  return { db, pool }
}
