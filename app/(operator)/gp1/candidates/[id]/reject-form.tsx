'use client'

import { useActionState, useState } from 'react'
import {
  CANDIDATE_NOTE_MAX_LENGTH,
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
        Note {reason === 'other' ? '(required)' : <span className="empty-state">(optional)</span>}
        <input
          name="note"
          maxLength={CANDIDATE_NOTE_MAX_LENGTH}
          required={reason === 'other'}
          autoComplete="off"
        />
      </label>
      {state.error ? <p className="op-error">{state.error}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? 'Rejecting…' : 'Reject candidate'}
      </button>
    </form>
  )
}
