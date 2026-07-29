import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import type { Db } from '@/lib/db/client'
import { getDb } from '@/lib/db/connection'
import { selectActiveOperator } from '@/lib/db/queries/operators'

// Resolves the authenticated + authorized operator for the current request
// (Decision 8). Returns null unless there is a valid Better Auth session AND an
// active `operators` row for that user. Server Components and Server Actions call
// this to gate the operator surface; there is no client-trusted authorization.
export interface OperatorContext {
  userId: string
  email: string
  name: string
}

export async function getCurrentOperator(db: Db = getDb()): Promise<OperatorContext | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  const user = session?.user
  if (!user) return null
  const operator = await selectActiveOperator(db, user.id)
  if (!operator) return null
  return { userId: user.id, email: user.email, name: user.name }
}
