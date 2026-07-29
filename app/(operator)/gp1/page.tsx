import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentOperator } from '@/lib/application/operators/current-operator'
import { listReviewQueue } from '@/lib/application/candidates/list-review-queue'
import { mapsOutboundUrl } from './maps-link'

export const dynamic = 'force-dynamic'

// GP-1 candidate review queue (Decision 9). MAPLESS by construction: this
// surface never imports map components, the Maps loader, or the browser Maps
// key (Decision 13d; enforced by ESLint and a boundary test). Candidates are
// Google Place IDs only; review happens via the Google Maps outbound link and
// our-side Overture suggestions.

export default async function Gp1QueuePage() {
  const operator = await getCurrentOperator()
  if (!operator) redirect('/login')

  const queue = await listReviewQueue()

  return (
    <main>
      <div className="op-header">
        <h1>GP-1 candidate queue</h1>
        <Link href="/admin">← Curation console</Link>
      </div>
      <p className="empty-state">
        {queue.length === 0
          ? 'No candidates awaiting review. Candidates arrive from operator-initiated seeding runs.'
          : `${queue.length} candidate(s) awaiting review — oldest first.`}
      </p>
      {queue.length > 0 ? (
        <table className="op-table">
          <thead>
            <tr>
              <th>Google Place ID</th>
              <th>Status</th>
              <th>Entered</th>
              <th>Decisions</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((c) => (
              <tr key={c.id}>
                <td>
                  <a href={mapsOutboundUrl(c.googlePlaceId)} target="_blank" rel="noreferrer">
                    {c.googlePlaceId}
                  </a>
                </td>
                <td>{c.status}</td>
                <td>{c.enteredAt.slice(0, 10)}</td>
                <td>{c.decisionCount}</td>
                <td>
                  <Link href={`/gp1/candidates/${c.id}`}>Review</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </main>
  )
}
