'use client'

import { useActionState, useState } from 'react'
import {
  CANDIDATE_NOTE_MAX_LENGTH,
  CANDIDATE_NOTE_MIN_LENGTH,
  CANDIDATE_REJECT_REASON_DEFINITIONS,
  CANDIDATE_REJECT_REASONS,
  type CandidateRejectReason,
} from '@/lib/domain/candidates'
import { type DecisionFormState, decideCandidateAction } from './actions'

const INITIAL: DecisionFormState = {}

export function RejectForm({ candidateId }: { candidateId: string }) {
  const [state, action, pending] = useActionState(decideCandidateAction, INITIAL)
  const [reason, setReason] = useState<CandidateRejectReason>('not_a_cafe')

  return (
    <form className="op-form" action={action}>
      <input type="hidden" name="candidateId" value={candidateId} />
      <input type="hidden" name="decision" value="rejected" />
      <label>
        Reason
        <select
          name="reasonCode"
          value={reason}
          onChange={(e) => setReason(e.target.value as CandidateRejectReason)}
        >
          {CANDIDATE_REJECT_REASONS.map((r) => (
            <option key={r} value={r}>
              {r.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
      </label>
      <p className="empty-state">{CANDIDATE_REJECT_REASON_DEFINITIONS[reason].definition}</p>
      <label>
        Why reject? (required — becomes training-label reasoning)
        <input
          name="note"
          required
          minLength={CANDIDATE_NOTE_MIN_LENGTH}
          maxLength={CANDIDATE_NOTE_MAX_LENGTH}
          placeholder="e.g. sign in the window says no laptops on weekends"
          autoComplete="off"
        />
      </label>
      <p className="empty-state">
        Your own overall judgment, in your own words — it may draw on everything you viewed, reviews
        and photos included (Decision 27). Never quote or paraphrase review text, and never include
        rating or review-count numbers.
      </p>
      {state.error ? <p className="op-error">{state.error}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? 'Rejecting…' : 'Reject candidate'}
      </button>
    </form>
  )
}
