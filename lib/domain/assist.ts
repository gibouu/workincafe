import { z } from 'zod'
import { CANDIDATE_REJECT_REASON_DEFINITIONS, CANDIDATE_REJECT_REASONS } from './candidates'

// Session-only AI pre-read contract (Decision 27b/27c). The brief is model
// output over live-fetched Google content: it is NEVER persisted, logged, or
// used as a Google-derived fact — it exists only to assist the reviewing
// operator during the session. The model is instructed to write assessments in
// its own words (no verbatim review quotes, no rating/count values) so nothing
// in the rendered brief invites prohibited content into operator notes.

export const ASSIST_EVIDENCE_SOURCES = ['reviews', 'photos', 'summary'] as const

// The rubric version stamps every stored prediction (27d) so agreement can be
// measured per rubric revision. Bump on ANY change to the reject-reason
// definitions or the assist system prompt — that is what makes rubric editing
// empirical instead of taste-debating.
export const RUBRIC_VERSION = 1

export const assistBriefSchema = z.strictObject({
  brief: z.string().min(1).max(1200),
  signals: z
    .array(
      z.strictObject({
        finding: z.string().min(1).max(300),
        source: z.enum(ASSIST_EVIDENCE_SOURCES),
        supports: z.enum(['approve', 'reject', 'unclear']),
      }),
    )
    .max(8),
  suggestedDecision: z.enum(['approved', 'rejected', 'deferred']),
  suggestedReasonCode: z.enum(CANDIDATE_REJECT_REASONS).nullable(),
  confidence: z.enum(['low', 'medium', 'high']),
})

export type AssistBrief = z.infer<typeof assistBriefSchema>

/** JSON Schema for the model's structured output (derived from the Zod contract). */
export function assistBriefJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(assistBriefSchema) as Record<string, unknown>
}

/** The rubric system prompt: WorkinCafe's own curation criteria, stated from
 * the same operational definitions the human reviewer uses. Pure. */
export function buildAssistSystemPrompt(): string {
  const reasons = CANDIDATE_REJECT_REASONS.map(
    (r) => `- ${r}: ${CANDIDATE_REJECT_REASON_DEFINITIONS[r].definition}`,
  ).join('\n')
  return [
    'You are the editorial pre-read assistant for WorkinCafe, a curated directory of',
    'study- and work-friendly cafés. A human editor makes every decision; your job is',
    'a transient brief: assess whether this candidate venue looks suitable for',
    'studying/working on a laptop, based ONLY on the material provided in this request.',
    '',
    'Rejection rubric (operational definitions):',
    reasons,
    '',
    'Signals that matter: laptops/screens visible at tables; seating type and amount;',
    'outlets; mentions of studying, working, wifi; signs restricting laptops or stay',
    'duration; takeout-only layouts; whether it is a café at all.',
    '',
    'Rules for your output:',
    '- Write every finding in your own words as an assessment. NEVER quote or closely',
    '  paraphrase review text; NEVER include rating values or review counts.',
    '- Do not identify review authors or any individuals; ignore faces in photos.',
    '- If the material is insufficient, say so and suggest deferred.',
    '- suggestedReasonCode must be null unless suggestedDecision is "rejected".',
  ].join('\n')
}
