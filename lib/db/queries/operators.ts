import { and, eq } from 'drizzle-orm'
import type { Db } from '../client'
import { operators } from '../schema/operators'

// WorkinCafe authorization lookup (Decision 8): an active `operators` row grants
// the single launch operator capability. Authentication (a Better Auth session)
// and authorization (this row) are separate.
export interface ActiveOperatorRow {
  userId: string
}

export async function selectActiveOperator(
  db: Db,
  userId: string,
): Promise<ActiveOperatorRow | null> {
  const rows = await db
    .select({ userId: operators.userId })
    .from(operators)
    .where(and(eq(operators.userId, userId), eq(operators.active, true)))
    .limit(1)
  return rows[0] ?? null
}
