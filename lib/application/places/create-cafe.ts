import type { Db } from '@/lib/db/client'
import { getDb } from '@/lib/db/connection'
import { isUniqueViolation } from '@/lib/db/errors'
import { insertCafe } from '@/lib/db/queries/cafe-mutations'
import { createCafeInputSchema } from '@/lib/domain/cafe-input'

// Use case: an authorized operator creates a new café. Records land in `draft`
// (Decision 8 — nothing is published without a human curation decision). The
// caller (a Server Action) must have already resolved an active operator and
// passes its user id as the curation-event actor. Validation lives in the domain
// schema; a slug collision is an expected outcome, not a crash.

export type CreateCafeResult =
  | { status: 'created'; id: string; slug: string }
  | { status: 'invalid'; message: string }
  | { status: 'slug_taken' }

export async function createCafe(
  rawInput: unknown,
  actorUserId: string,
  db: Db = getDb(),
): Promise<CreateCafeResult> {
  const parsed = createCafeInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const path = issue?.path.join('.')
    const message = issue ? (path ? `${path}: ${issue.message}` : issue.message) : 'Invalid input.'
    return { status: 'invalid', message }
  }
  try {
    const { id, slug } = await insertCafe(db, parsed.data, actorUserId)
    return { status: 'created', id, slug }
  } catch (error) {
    if (isUniqueViolation(error, 'places_slug_key')) return { status: 'slug_taken' }
    throw error
  }
}
