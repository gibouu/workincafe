import type { Db } from '@/lib/db/client'
import { getDb } from '@/lib/db/connection'
import {
  type ApplyCandidateDecisionResult,
  applyCandidateDecision,
} from '@/lib/db/queries/candidate-mutations'
import { candidateDecisionInputSchema } from '@/lib/domain/candidates'

// Use case: an authorized operator decides a GP-1 candidate (Decision 9 —
// human review before any candidate becomes a published café; approval creates
// a DRAFT record, publication stays a separate deliberate act). The caller (a
// Server Action) has already resolved an active operator. Everything about the
// decision — appended evidence, feature snapshot, status projection, draft
// creation on approval — is one transaction in the query layer.

export type DecideCandidateResult =
  ApplyCandidateDecisionResult | { status: 'invalid'; message: string }

export async function decideCandidate(
  rawInput: unknown,
  actorUserId: string,
  db: Db = getDb(),
): Promise<DecideCandidateResult> {
  const parsed = candidateDecisionInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const path = issue?.path.join('.')
    const message = issue ? (path ? `${path}: ${issue.message}` : issue.message) : 'Invalid input.'
    return { status: 'invalid', message }
  }
  return applyCandidateDecision(db, parsed.data, actorUserId)
}
