import type { Db } from '@/lib/db/client'
import { getDb } from '@/lib/db/connection'
import { upsertCafeHours } from '@/lib/db/queries/hours-mutations'
import { setCafeHoursInputSchema } from '@/lib/domain/hours-input'

// Use case: an authorized operator saves a café's structured weekly hours
// (Decision 9 — official-venue/manual recording, facts only, `unknown` is
// first-class and distinct from `closed`; publication requires all seven days
// known, Decision 28). An OSM-applied save (Decision 29) carries `osmSource`
// and persists as an operator-verified import with its OSM element reference.
// The caller (a Server Action) must have already resolved an active operator
// and passes its user id as the verifying operator. The write pairs the hours
// upsert with its `hours_updated` curation event in one transaction.

export type SetCafeHoursResult =
  | { status: 'saved' }
  | { status: 'invalid'; message: string }
  | { status: 'not_found' }
  | { status: 'osm_ref_conflict' }

export async function setCafeHours(
  rawInput: unknown,
  actorUserId: string,
  db: Db = getDb(),
): Promise<SetCafeHoursResult> {
  const parsed = setCafeHoursInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const path = issue?.path.join('.')
    const message = issue ? (path ? `${path}: ${issue.message}` : issue.message) : 'Invalid input.'
    return { status: 'invalid', message }
  }

  const result = await upsertCafeHours(db, parsed.data, actorUserId)
  return { status: result }
}
