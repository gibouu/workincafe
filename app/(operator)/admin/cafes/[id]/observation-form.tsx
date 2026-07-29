'use client'

import { useActionState, useState } from 'react'
import {
  ATTRIBUTE_KINDS,
  ATTRIBUTE_VALUE_DEFINITIONS,
  ATTRIBUTE_VALUES,
  type AttributeKind,
} from '@/lib/domain/attributes'
import { OBSERVATION_NOTE_MAX_LENGTH } from '@/lib/domain/attribute-observation-input'
import { CONFIDENCE_LEVELS } from '@/lib/domain/provenance'
import { type CurationFormState, recordObservationAction } from './actions'

const INITIAL: CurationFormState = {}

function label(value: string): string {
  return value.replaceAll('_', ' ')
}

export function ObservationForm({ placeId }: { placeId: string }) {
  const [state, action, pending] = useActionState(recordObservationAction, INITIAL)
  const [kind, setKind] = useState<AttributeKind>('wifi')
  const [value, setValue] = useState<string>('unknown')

  const values = ATTRIBUTE_VALUES[kind]
  const currentValue = (values as readonly string[]).includes(value) ? value : 'unknown'
  const definitions = ATTRIBUTE_VALUE_DEFINITIONS[kind] as Record<string, string>

  return (
    <form className="op-form" action={action}>
      <input type="hidden" name="placeId" value={placeId} />
      <label>
        Attribute
        <select
          name="kind"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as AttributeKind)
            setValue('unknown')
          }}
        >
          {ATTRIBUTE_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>
      <label>
        Value
        <select name="value" value={currentValue} onChange={(e) => setValue(e.target.value)}>
          {values.map((v) => (
            <option key={v} value={v}>
              {label(v)}
            </option>
          ))}
        </select>
      </label>
      <p className="empty-state">{definitions[currentValue]}</p>
      <label>
        Confidence
        <select name="confidence" defaultValue="medium">
          {CONFIDENCE_LEVELS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label>
        Observed on
        <input
          name="observedAt"
          type="date"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
        />
      </label>
      <label>
        Note <span className="empty-state">(optional, operator-authored only)</span>
        <input name="note" maxLength={OBSERVATION_NOTE_MAX_LENGTH} autoComplete="off" />
      </label>
      {state.error ? <p className="op-error">{state.error}</p> : null}
      {state.saved ? <p className="empty-state">Recorded — now the current value.</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? 'Recording…' : 'Record observation'}
      </button>
    </form>
  )
}
