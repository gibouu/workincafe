import type { Db } from '@/lib/db/client'
import { getDb } from '@/lib/db/connection'
import { insertCuratorObservation } from '@/lib/db/queries/attribute-mutations'
import { createAttributePromotionRepository } from '@/lib/db/repositories/attribute-promotion-repo'
import { recordObservationInputSchema } from '@/lib/domain/attribute-observation-input'
import { promoteAttributeObservation } from './promote-attribute-observation'

// Use case: an authorized operator records a study-attribute observation and
// makes it the current value in one deliberate curation act. The evidence
// (immutable observation + the operator's `accepted` decision) is appended and
// the observation is then promoted through the promotion use case — the only
// code allowed to move the current pointer — all inside one transaction, so
// evidence, decision, pointer, and the `attribute_promoted` curation event
// cannot diverge. The caller (a Server Action) must have already resolved an
// active operator and passes its user id as the actor.

export type RecordAttributeObservationResult =
  { status: 'recorded' } | { status: 'invalid'; message: string } | { status: 'not_found' }

export async function recordAttributeObservation(
  rawInput: unknown,
  actorUserId: string,
  db: Db = getDb(),
): Promise<RecordAttributeObservationResult> {
  const parsed = recordObservationInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const path = issue?.path.join('.')
    const message = issue ? (path ? `${path}: ${issue.message}` : issue.message) : 'Invalid input.'
    return { status: 'invalid', message }
  }

  return db.transaction(async (tx) => {
    const inserted = await insertCuratorObservation(tx, parsed.data, actorUserId)
    if (!inserted) return { status: 'not_found' as const }

    const promotion = await promoteAttributeObservation(
      {
        placeId: parsed.data.placeId,
        kind: parsed.data.kind,
        observationId: inserted.observationId,
        actor: { kind: 'operator', operatorUserId: actorUserId },
      },
      createAttributePromotionRepository(tx),
    )
    // An operator promoting their own freshly-accepted curator observation always
    // succeeds (decidePromotion: operator + accepted → promote). Anything else is
    // a programming error — throw so the whole transaction rolls back.
    if (promotion.status !== 'promoted') {
      throw new Error(`unexpected promotion outcome: ${promotion.status}`)
    }
    return { status: 'recorded' as const }
  })
}
