import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentOperator } from '@/lib/application/operators/current-operator'
import { getCafeCuration } from '@/lib/application/places/get-cafe-curation'
import { getCurationNextSteps } from '@/lib/application/places/get-curation-next-steps'
import { ATTRIBUTE_KINDS } from '@/lib/domain/attributes'
import { HoursForm } from './hours-form'
import { ObservationForm } from './observation-form'

export const dynamic = 'force-dynamic'

export default async function CafeCurationPage({ params }: { params: Promise<{ id: string }> }) {
  const operator = await getCurrentOperator()
  if (!operator) redirect('/login')

  const { id } = await params
  const view = await getCafeCuration(id)
  if (!view) notFound()
  const { cafe, attributeDetails, hours } = view
  const next = await getCurationNextSteps(cafe.id)

  return (
    <main>
      <div className="op-header">
        <h1>{cafe.name}</h1>
        <Link href="/admin">← Back to console</Link>
      </div>
      <p className="empty-state">
        {cafe.publicationState} · {cafe.recordState} · /cafes/{cafe.slug}
      </p>

      <h2>Study attributes</h2>
      <table className="op-table">
        <thead>
          <tr>
            <th>Attribute</th>
            <th>Current value</th>
            <th>Provenance</th>
            <th>Confidence</th>
            <th>Observed</th>
          </tr>
        </thead>
        <tbody>
          {ATTRIBUTE_KINDS.map((kind) => {
            const detail = attributeDetails[kind]
            return (
              <tr key={kind}>
                <td>{kind}</td>
                <td>{detail.value.replaceAll('_', ' ')}</td>
                <td>{detail.provenance ?? '—'}</td>
                <td>{detail.confidence ?? '—'}</td>
                <td>{detail.observedAt ? detail.observedAt.slice(0, 10) : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <h2>Record observation</h2>
      <p className="empty-state">
        Appends immutable curator evidence and makes it the current value.
      </p>
      <ObservationForm placeId={cafe.id} />

      <h2>Hours</h2>
      <p className="empty-state">
        Facts only — never guess; verify from the venue&apos;s own site or in person, or prefill
        from the website check or OSM lookup and confirm (source/16, source/17). Publishing requires
        all seven days known (open or closed — any unknown day blocks publication; source/15).
      </p>
      <HoursForm placeId={cafe.id} initial={hours} websiteUrl={cafe.website} />

      <h2>Continue</h2>
      <p>
        {next.nextCandidateId ? (
          <Link href={`/gp1/candidates/${next.nextCandidateId}`}>
            → Next pending candidate ({next.reviewableCount} in queue)
          </Link>
        ) : (
          <span className="empty-state">Review queue is empty. </span>
        )}
        {'  '}
        {next.nextHoursCafe ? (
          <Link href={`/admin/cafes/${next.nextHoursCafe.id}`}>
            → Next café needing hours: {next.nextHoursCafe.name} ({next.hoursIncompleteCount} left)
          </Link>
        ) : (
          <span className="empty-state">No other cafés are blocked on hours.</span>
        )}
      </p>
    </main>
  )
}
