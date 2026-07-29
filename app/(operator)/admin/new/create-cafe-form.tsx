'use client'

import { useActionState } from 'react'
import { type CreateCafeFormState, createCafeAction } from '../actions'
import { SLUG_MAX_LENGTH, SLUG_PATTERN } from '@/lib/domain/places'

const INITIAL: CreateCafeFormState = {}

// HTML `pattern` needs a source without anchors/flags; mirror the domain slug
// rule for an early client-side hint (the server schema is the source of truth).
const SLUG_HTML_PATTERN = SLUG_PATTERN.source.replace(/^\^|\$$/g, '')

export function CreateCafeForm() {
  const [state, action, pending] = useActionState(createCafeAction, INITIAL)

  return (
    <form className="op-form" action={action}>
      <label>
        Name
        <input name="name" required maxLength={200} autoComplete="off" />
      </label>
      <label>
        Slug
        <input
          name="slug"
          required
          maxLength={SLUG_MAX_LENGTH}
          pattern={SLUG_HTML_PATTERN}
          placeholder="lowercase-with-hyphens"
          autoComplete="off"
        />
      </label>
      <label>
        Latitude
        <input name="latitude" type="number" step="any" min={-90} max={90} required />
      </label>
      <label>
        Longitude
        <input name="longitude" type="number" step="any" min={-180} max={180} required />
      </label>
      <label>
        Address <span className="empty-state">(optional)</span>
        <input name="address" maxLength={500} autoComplete="off" />
      </label>
      <label>
        Neighborhood <span className="empty-state">(optional)</span>
        <input name="neighborhood" maxLength={120} autoComplete="off" />
      </label>
      <label>
        Website <span className="empty-state">(optional)</span>
        <input
          name="website"
          type="url"
          maxLength={500}
          placeholder="https://…"
          autoComplete="off"
        />
      </label>
      <label>
        Phone <span className="empty-state">(optional)</span>
        <input name="phone" maxLength={60} autoComplete="off" />
      </label>
      {state.error ? <p className="op-error">{state.error}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create draft café'}
      </button>
    </form>
  )
}
