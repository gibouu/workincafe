'use client'

import { useActionState, useState } from 'react'
import { SLUG_MAX_LENGTH, SLUG_PATTERN } from '@/lib/domain/places'
import { type DecisionFormState, decideCandidateAction } from './actions'

const INITIAL: DecisionFormState = {}
const SLUG_HTML_PATTERN = SLUG_PATTERN.source.replace(/^\^|\$$/g, '')

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
}

export function ApproveForm({
  candidateId,
  match,
}: {
  candidateId: string
  match: { gersId: string; name: string; address: string | null } | null
}) {
  const [state, action, pending] = useActionState(decideCandidateAction, INITIAL)
  const [name, setName] = useState(match?.name ?? '')
  const [slug, setSlug] = useState(match ? slugify(match.name) : '')

  return (
    <form className="op-form" action={action}>
      <input type="hidden" name="candidateId" value={candidateId} />
      <input type="hidden" name="decision" value="approved" />
      {match ? (
        <>
          <input type="hidden" name="matchedGersId" value={match.gersId} />
          <p className="empty-state">
            Matched: {match.name}
            {match.address ? ` — ${match.address}` : ''} (coordinates and basic facts come from the
            Overture record)
          </p>
        </>
      ) : (
        <p className="empty-state">
          No Overture match selected — enter the venue facts you can confirm yourself.
        </p>
      )}
      <label>
        Name
        <input
          name="name"
          required
          maxLength={200}
          autoComplete="off"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setSlug(slugify(e.target.value))
          }}
        />
      </label>
      <label>
        Slug
        <input
          name="slug"
          required
          maxLength={SLUG_MAX_LENGTH}
          pattern={SLUG_HTML_PATTERN}
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          autoComplete="off"
        />
      </label>
      {!match ? (
        <>
          <label>
            Latitude
            <input name="latitude" type="number" step="any" min={-90} max={90} required />
          </label>
          <label>
            Longitude
            <input name="longitude" type="number" step="any" min={-180} max={180} required />
          </label>
        </>
      ) : null}
      {state.error ? <p className="op-error">{state.error}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? 'Approving…' : 'Approve → create draft café'}
      </button>
    </form>
  )
}
