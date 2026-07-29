import { sql } from 'drizzle-orm'
import { createDb, type DbHandle } from '@/lib/db/client'

// Shared plumbing for operator-run database CLIs (Decision 19b/19e): direct
// connection resolution with a clear missing-config failure, and a fail-fast
// advisory job lock for scripts where duplicate concurrent execution is unsafe.

export function openScriptDb(scriptName: string): DbHandle {
  const url =
    process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
  if (!url) {
    console.error(
      `${scriptName}: set DATABASE_URL_DIRECT (or DATABASE_URL_UNPOOLED / DATABASE_URL) to the target database.`,
    )
    process.exit(1)
  }
  return createDb(url)
}

/** Run `fn` holding the advisory lock; fail fast (exit 1) if it is already held. */
export async function withJobLock<T>(
  handle: DbHandle,
  lockKey: number,
  scriptName: string,
  fn: () => Promise<T>,
): Promise<T> {
  const res = await handle.db.execute<{ locked: boolean }>(
    sql`SELECT pg_try_advisory_lock(${lockKey}) AS locked`,
  )
  if (res.rows[0]?.locked !== true) {
    console.error(`${scriptName}: another run appears to be in progress (job lock held); aborting.`)
    process.exit(1)
  }
  try {
    return await fn()
  } finally {
    await handle.db.execute(sql`SELECT pg_advisory_unlock(${lockKey})`)
  }
}
