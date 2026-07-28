import { serverEnv } from '@/lib/env/server'
import { createDb, type Db } from './client'

// One reusable pg pool + Drizzle client per server runtime instance (Decision 6).
// Lazily created on first use so importing this module never opens a connection
// (safe for `next build`). Application use cases obtain the client through this
// accessor; routes/components never touch it directly (ESLint boundary). Tests
// inject their own client instead of calling getDb().
let handle: { db: Db } | null = null

export function getDb(): Db {
  if (handle === null) {
    handle = createDb(serverEnv().DATABASE_URL)
  }
  return handle.db
}
