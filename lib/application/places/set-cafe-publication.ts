import { z } from 'zod'
import type { Db } from '@/lib/db/client'
import { getDb } from '@/lib/db/connection'
import { setCafePublicationState } from '@/lib/db/queries/cafe-mutations'
import type { PublicationTransition } from '@/lib/domain/cafe-input'

// Use case: an authorized operator publishes or hides a café — the two operator
// publication transitions in this slice (Decision 8; there is no automatic
// publication). The caller (a Server Action) has already resolved an active
// operator and passes its user id as the curation-event actor. `unchanged`
// covers a no-op (record not active, missing, or already in the target state).

const placeIdSchema = z.uuid()

export type SetCafePublicationResult =
  { status: 'updated' } | { status: 'unchanged' } | { status: 'invalid' }

export async function setCafePublication(
  placeId: string,
  target: PublicationTransition,
  actorUserId: string,
  db: Db = getDb(),
): Promise<SetCafePublicationResult> {
  if (!placeIdSchema.safeParse(placeId).success) return { status: 'invalid' }
  const changed = await setCafePublicationState(db, placeId, target, actorUserId)
  return changed ? { status: 'updated' } : { status: 'unchanged' }
}
