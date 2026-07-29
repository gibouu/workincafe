import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { selectActiveOperator } from '@/lib/db/queries/operators'
import type { DbHandle } from '@/lib/db/client'
import { insertOperator, insertUser, openTestDb } from './helpers'

// The authorization gate (Decision 8): an operator is authorized only via an
// active `operators` row. Authentication (the Better Auth session) is verified
// end-to-end on the deployed operator surface.
let handle: DbHandle
beforeAll(() => {
  handle = openTestDb()
})
afterAll(async () => {
  await handle.pool.end()
})

describe('selectActiveOperator (authorization gate)', () => {
  it('returns the operator for an active row', async () => {
    const userId = await insertUser(handle.db)
    await insertOperator(handle.db, userId, true)
    expect(await selectActiveOperator(handle.db, userId)).toEqual({ userId })
  })

  it('returns null when the user has no operator row', async () => {
    const userId = await insertUser(handle.db)
    expect(await selectActiveOperator(handle.db, userId)).toBeNull()
  })

  it('returns null when the operator row is inactive', async () => {
    const userId = await insertUser(handle.db)
    await insertOperator(handle.db, userId, false)
    expect(await selectActiveOperator(handle.db, userId)).toBeNull()
  })
})
