import type { Db } from '@/lib/db/client'
import { getDb } from '@/lib/db/connection'
import { type AdminCafeRow, selectAllCafes } from '@/lib/db/queries/admin-cafes'

// Use case: list every café for the operator console (all publication/record
// states). Callers must already be authorized as an operator.
export async function listCafesForAdmin(db: Db = getDb()): Promise<AdminCafeRow[]> {
  return selectAllCafes(db)
}
