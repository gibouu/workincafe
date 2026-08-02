import type { AssistResult } from '@/lib/contracts/http/assist'
import type { Db } from '@/lib/db/client'
import { getDb } from '@/lib/db/connection'
import { insertProviderCallAttempt } from '@/lib/db/queries/accounting-mutations'
import { insertAssistPrediction } from '@/lib/db/queries/assist-mutations'
import { selectCandidateById } from '@/lib/db/queries/candidate-queries'
import { buildAssistSystemPrompt, RUBRIC_VERSION } from '@/lib/domain/assist'
import type { OutboundAttempt } from '@/lib/domain/seeding-queries'
import { serverEnv } from '@/lib/env/server'
import {
  ASSIST_MODEL,
  type AssistImage,
  runAssistInference,
} from '@/lib/integrations/anthropic/server/messages'
import {
  fetchPhotoMedia,
  fetchPlaceAssistContent,
} from '@/lib/integrations/google/server/place-details'

// Use case: the Decision 27 AI pre-read for one candidate — operator-triggered
// only, session-only end to end. Live-fetch place content (details + up to 3
// photos), run one no-training model inference over it, return the attributed
// display DTO + transient brief. Nothing from this flow persists except the
// per-attempt billable-call accounting rows (operational data only). Fails
// closed when either credential is absent.

export type GetAssistBriefResult =
  | ({ status: 'ok' } & AssistResult)
  | { status: 'unavailable' }
  | { status: 'not_found' }
  | { status: 'failed' }

export async function getAssistBrief(
  candidateId: string,
  db: Db = getDb(),
): Promise<GetAssistBriefResult> {
  const env = serverEnv()
  const googleKey = env.GOOGLE_PLACES_SERVER_KEY
  const anthropicKey = env.ANTHROPIC_API_KEY
  if (!googleKey || !anthropicKey) return { status: 'unavailable' }

  const candidate = await selectCandidateById(db, candidateId)
  if (!candidate) return { status: 'not_found' }

  const account = (attempt: OutboundAttempt) =>
    insertProviderCallAttempt(db, {
      sku: attempt.sku,
      context: 'gp1_assist',
      candidateId,
      httpStatus: attempt.httpStatus,
    })

  const details = await fetchPlaceAssistContent(candidate.googlePlaceId, googleKey, account)
  if (details.status !== 'ok') return { status: 'failed' }

  const images: AssistImage[] = []
  for (const name of details.content.photoNames) {
    const photo = await fetchPhotoMedia(name, googleKey, account)
    if (photo) images.push(photo)
  }

  const d = details.content.display
  const userText = [
    `Candidate venue: ${d.name}${d.address ? ` — ${d.address}` : ''}`,
    d.generativeSummary ? `\nPlace summary:\n${d.generativeSummary}` : '',
    d.reviewSummary ? `\nReview summary:\n${d.reviewSummary}` : '',
    d.reviews.length
      ? `\nRecent reviews:\n${d.reviews.map((r) => `- ${r.text}`).join('\n')}`
      : '\nNo reviews available.',
    images.length ? `\n${images.length} venue photo(s) attached.` : '',
  ].join('')

  const inference = await runAssistInference(
    { system: buildAssistSystemPrompt(), userText, images },
    anthropicKey,
    account,
  )
  if (inference.status !== 'ok') return { status: 'failed' }

  // Decision 27d: persist ONLY the non-reconstructable prediction triple (the
  // prose brief stays session-only). This durable record is what makes the
  // operator's next decision an "assisted" label and enables agreement
  // measurement per rubric version.
  await insertAssistPrediction(db, {
    candidateId,
    brief: inference.brief,
    rubricVersion: RUBRIC_VERSION,
    model: ASSIST_MODEL,
  })

  return { status: 'ok', display: d, brief: inference.brief }
}
