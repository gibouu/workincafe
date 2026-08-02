import { sql } from 'drizzle-orm'
import type { AssistBrief } from '@/lib/domain/assist'
import type { Db } from '../client'

// Decision 27d write/read paths for stored predictions. Only the
// non-reconstructable enum triple + provenance stamps persist; append-only.

export async function insertAssistPrediction(
  db: Db,
  input: { candidateId: string; brief: AssistBrief; rubricVersion: number; model: string },
): Promise<string> {
  const res = await db.execute<{ id: string }>(sql`
    INSERT INTO assist_predictions
      (candidate_id, suggested_decision, suggested_reason_code, confidence, rubric_version, model)
    VALUES (${input.candidateId}, ${input.brief.suggestedDecision},
            ${input.brief.suggestedReasonCode}, ${input.brief.confidence},
            ${input.rubricVersion}, ${input.model})
    RETURNING id
  `)
  return res.rows[0].id
}

export interface LatestPrediction {
  id: string
  suggestedDecision: string
  createdAt: string
}

export async function selectLatestPrediction(
  db: Db,
  candidateId: string,
): Promise<LatestPrediction | null> {
  const res = await db.execute<{ id: string; suggested_decision: string; created_at: unknown }>(sql`
    SELECT id, suggested_decision, created_at FROM assist_predictions
    WHERE candidate_id = ${candidateId}
    ORDER BY created_at DESC, id DESC LIMIT 1
  `)
  const row = res.rows[0]
  if (!row) return null
  return {
    id: row.id,
    suggestedDecision: row.suggested_decision,
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }
}

// Label-capture transparency (the sequencing scorecard). Baseline = final
// decisions recorded with NO stored prediction in existence; agreement is
// computed ONLY over WorkinCafe-stored values (predictions vs decisions) —
// Google content never enters evaluation (Decision 27 general conditions).
export interface LabelStats {
  finalDecisions: number
  baseline: number
  assisted: number
  assistedAgreements: number
}

export async function selectLabelStats(db: Db): Promise<LabelStats> {
  const res = await db.execute<{
    final_decisions: number
    baseline: number
    assisted: number
    assisted_agreements: number
  }>(sql`
    SELECT
      count(*)::int AS final_decisions,
      count(*) FILTER (WHERE d.assisted_by_prediction_id IS NULL)::int AS baseline,
      count(*) FILTER (WHERE d.assisted_by_prediction_id IS NOT NULL)::int AS assisted,
      count(*) FILTER (
        WHERE p.id IS NOT NULL AND p.suggested_decision = d.decision
      )::int AS assisted_agreements
    FROM candidate_decisions d
    LEFT JOIN assist_predictions p ON p.id = d.assisted_by_prediction_id
    WHERE d.decision IN ('approved', 'rejected')
  `)
  const row = res.rows[0]
  return {
    finalDecisions: row.final_decisions,
    baseline: row.baseline,
    assisted: row.assisted,
    assistedAgreements: row.assisted_agreements,
  }
}
