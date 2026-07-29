'use client'

import { useActionState, useState } from 'react'
import { SEEDING_QUERY_TEMPLATES } from '@/lib/domain/seeding-queries'
import { type SeedingFormState, runSeedingAction } from './actions'

const INITIAL: SeedingFormState = {}

export function SeedingForm() {
  const [state, action, pending] = useActionState(runSeedingAction, INITIAL)
  const [templateId, setTemplateId] = useState(SEEDING_QUERY_TEMPLATES[0].id)
  const template = SEEDING_QUERY_TEMPLATES.find((t) => t.id === templateId)

  return (
    <form className="op-form" action={action}>
      <label>
        Approved query template
        <select
          name="templateId"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
        >
          {SEEDING_QUERY_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.id}
            </option>
          ))}
        </select>
      </label>
      {template ? (
        <p className="empty-state">
          “{template.textQuery}” — {template.description}
        </p>
      ) : null}
      {state.error ? <p className="op-error">{state.error}</p> : null}
      {state.summary ? <p className="empty-state">{state.summary}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? 'Running…' : 'Run seeding (billable)'}
      </button>
    </form>
  )
}
