'use client'

import { useActionState } from 'react'
import { CANDIDATE_NOTE_MAX_LENGTH } from '@/lib/domain/candidates'
import { type DecisionFormState, decideCandidateAction } from './actions'

const INITIAL: DecisionFormState = {}

export function DeferForm({ candidateId }: { candidateId: string }) {
  const [state, action, pending] = useActionState(decideCandidateAction, INITIAL)

  return (
    <form className="op-form" action={action}>
      <input type="hidden" name="candidateId" value={candidateId} />
      <input type="hidden" name="decision" value="deferred" />
      <label>
        Note <span className="empty-state">(optional — what would resolve this?)</span>
        <input name="note" maxLength={CANDIDATE_NOTE_MAX_LENGTH} autoComplete="off" />
      </label>
      {state.error ? <p className="op-error">{state.error}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? 'Deferring…' : 'Defer for later'}
      </button>
    </form>
  )
}
