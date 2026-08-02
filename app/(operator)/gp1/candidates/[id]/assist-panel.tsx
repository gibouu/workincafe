'use client'

import { useActionState } from 'react'
import { type AssistFormState, runAssistAction } from './actions'

const INITIAL: AssistFormState = {}

// Decision 27b/27f: session-only AI pre-read + attributed live display. All
// content below renders for this session only — it is never stored, and the
// operator's durable note must remain their own words (the brief is written as
// assessments, never quotes, to keep copy-through safe).

export function AssistPanel({ candidateId }: { candidateId: string }) {
  const [state, action, pending] = useActionState(runAssistAction, INITIAL)
  const r = state.result

  return (
    <div>
      <form className="op-form" action={action}>
        <input type="hidden" name="candidateId" value={candidateId} />
        {state.error ? <p className="op-error">{state.error}</p> : null}
        <button type="submit" disabled={pending}>
          {pending ? 'Reading…' : 'Run AI pre-read (billable)'}
        </button>
      </form>

      {r ? (
        <div className="op-assist">
          <h3>
            {r.display.name}
            {r.display.rating !== null ? (
              <span className="empty-state">
                {' '}
                · {r.display.rating} ★ ({r.display.userRatingCount ?? 0})
              </span>
            ) : null}
          </h3>
          {r.display.businessStatus && r.display.businessStatus !== 'OPERATIONAL' ? (
            <p className="op-error">Business status: {r.display.businessStatus}</p>
          ) : null}
          {r.display.primaryType || r.display.facts.length > 0 ? (
            <p className="empty-state">
              {r.display.primaryType ? `Type: ${r.display.primaryType}` : ''}
              {r.display.facts.length > 0
                ? ` · ${r.display.facts.map((f) => `${f.label}: ${f.value ? 'yes' : 'no'}`).join(' · ')}`
                : ''}
            </p>
          ) : null}
          <p className="empty-state">
            {r.display.address ?? ''} · Powered by Google ·{' '}
            {r.display.googleMapsUri ? (
              <a href={r.display.googleMapsUri} target="_blank" rel="noreferrer">
                View on Google Maps ↗
              </a>
            ) : null}
          </p>

          <h4>AI brief (session-only — not stored; the decision is yours)</h4>
          <p>{r.brief.brief}</p>
          <ul>
            {r.brief.signals.map((s, i) => (
              <li key={i}>
                <strong>{s.supports}</strong>: {s.finding}{' '}
                <span className="empty-state">({s.source})</span>
              </li>
            ))}
          </ul>
          <p>
            Suggestion: <strong>{r.brief.suggestedDecision}</strong>
            {r.brief.suggestedReasonCode ? ` (${r.brief.suggestedReasonCode})` : ''} — confidence{' '}
            {r.brief.confidence}
          </p>

          {r.display.reviewSummary || r.display.generativeSummary ? (
            <>
              <h4>Google summaries</h4>
              {r.display.generativeSummary ? <p>{r.display.generativeSummary}</p> : null}
              {r.display.reviewSummary ? <p>{r.display.reviewSummary}</p> : null}
              {r.display.summaryDisclosure ? (
                <p className="empty-state">{r.display.summaryDisclosure}</p>
              ) : null}
            </>
          ) : null}

          {r.display.reviews.length > 0 ? (
            <>
              <h4>Reviews (Google)</h4>
              {r.display.reviews.map((rev, i) => (
                <div className="op-review" key={i}>
                  <p className="empty-state">
                    {rev.authorPhotoUri ? (
                      // Author avatar is part of the required attribution; it is
                      // hot-loaded from Google, never proxied or optimized.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={rev.authorPhotoUri} alt="" width={20} height={20} />
                    ) : null}{' '}
                    {rev.authorUri ? (
                      <a href={rev.authorUri} target="_blank" rel="noreferrer">
                        {rev.authorName}
                      </a>
                    ) : (
                      rev.authorName
                    )}
                    {rev.relativeTime ? ` · ${rev.relativeTime}` : ''}
                  </p>
                  <p>{rev.text}</p>
                </div>
              ))}
            </>
          ) : null}
          {r.display.photoCount > 0 ? (
            <p className="empty-state">
              {r.display.photoCount} photo(s) were analyzed by the model (not displayed here).
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
