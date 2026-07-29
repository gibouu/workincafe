import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentOperator } from '@/lib/application/operators/current-operator'
import { getCandidate } from '@/lib/application/candidates/get-candidate'
import { searchMatches } from '@/lib/application/candidates/search-matches'
import { mapsOutboundUrl } from '../../maps-link'
import { ApproveForm } from './approve-form'
import { RejectForm } from './reject-form'
import { DeferForm } from './defer-form'

export const dynamic = 'force-dynamic'

// GP-1 candidate review page (mapless — Decision 13d). Human-confirmed
// matching (Decision 9): the operator opens the Google Maps outbound link,
// then searches OUR Overture index by name (a GET form — the query is
// URL-committed, session-only state) and either approves with the selected
// match (or manual fields), rejects with a reason, or defers.

export default async function CandidateReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ q?: string; match?: string }>
}) {
  const operator = await getCurrentOperator()
  if (!operator) redirect('/login')

  const { id } = await params
  const candidate = await getCandidate(id)
  if (!candidate) notFound()

  const { q, match } = await searchParams
  const suggestions = q ? await searchMatches(q) : []
  const selected = match ? suggestions.find((s) => s.gersId === match) : undefined

  const reviewable = candidate.status === 'pending' || candidate.status === 'deferred'

  return (
    <main>
      <div className="op-header">
        <h1>Candidate review</h1>
        <Link href="/gp1">← Queue</Link>
      </div>
      <p>
        <a href={mapsOutboundUrl(candidate.googlePlaceId)} target="_blank" rel="noreferrer">
          Open on Google Maps ↗
        </a>{' '}
        <span className="empty-state">
          {candidate.googlePlaceId} · {candidate.status} · entered{' '}
          {candidate.enteredAt.slice(0, 10)}
        </span>
      </p>

      {!reviewable ? (
        <p className="empty-state">
          This candidate is {candidate.status}.{' '}
          {candidate.createdPlaceId ? (
            <Link href={`/admin/cafes/${candidate.createdPlaceId}`}>Open its café record →</Link>
          ) : null}
        </p>
      ) : (
        <>
          <h2>Find the matching Overture record</h2>
          <p className="empty-state">
            Type the venue name as shown on Google Maps; suggestions come from our own matching
            index.
          </p>
          <form className="op-form" method="get">
            <label>
              Name search
              <input name="q" defaultValue={q ?? ''} minLength={2} maxLength={100} required />
            </label>
            <button type="submit">Search index</button>
          </form>
          {q && suggestions.length === 0 ? (
            <p className="empty-state">
              No index matches. Approve with manual fields below, or defer/reject.
            </p>
          ) : null}
          {suggestions.length > 0 ? (
            <table className="op-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Address</th>
                  <th>Linked</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((s) => (
                  <tr key={s.gersId}>
                    <td>{s.name}</td>
                    <td>{s.primaryCategory ?? '—'}</td>
                    <td>{s.address ?? '—'}</td>
                    <td>
                      {s.alreadyLinkedPlaceId ? (
                        <Link href={`/admin/cafes/${s.alreadyLinkedPlaceId}`}>already linked</Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <Link
                        href={`/gp1/candidates/${candidate.id}?q=${encodeURIComponent(q ?? '')}&match=${encodeURIComponent(s.gersId)}`}
                      >
                        {selected?.gersId === s.gersId ? 'selected ✓' : 'select'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          <h2>Approve → draft café</h2>
          <ApproveForm
            candidateId={candidate.id}
            match={
              selected
                ? { gersId: selected.gersId, name: selected.name, address: selected.address }
                : null
            }
          />

          <h2>Reject</h2>
          <RejectForm candidateId={candidate.id} />

          <h2>Defer</h2>
          <DeferForm candidateId={candidate.id} />
        </>
      )}
    </main>
  )
}
