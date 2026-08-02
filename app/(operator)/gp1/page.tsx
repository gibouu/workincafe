import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentOperator } from '@/lib/application/operators/current-operator'
import { listReviewQueue } from '@/lib/application/candidates/list-review-queue'
import { getLabelStats } from '@/lib/application/candidates/get-label-stats'
import { rubricLoopStatus } from '@/lib/domain/assist'
import { listSeedingRuns } from '@/lib/application/candidates/list-seeding-runs'
import { mapsOutboundUrl } from './maps-link'
import { SeedingForm } from './seeding-form'

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
  const runs = await listSeedingRuns()
  const labels = await getLabelStats()
  const rubric = rubricLoopStatus(labels.finalDecisions)

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

      <h2>Label capture</h2>
      <p className="empty-state">
        Final decisions recorded: {labels.finalDecisions} — baseline (unassisted): {labels.baseline}{' '}
        · assisted: {labels.assisted}
        {labels.assisted > 0
          ? ` · pre-read agreement: ${Math.round((labels.assistedAgreements / labels.assisted) * 100)}%`
          : ''}
        . Every decision is permanently marked baseline or assisted at write time.
      </p>
      {rubric.due ? (
        <p className="op-error">
          Rubric distillation is due (rubric v{rubric.version};{' '}
          {rubric.isFirstDistillation ? 'baseline batch complete' : 'interval reached'} at{' '}
          {labels.finalDecisions} final decisions). Run the rubric loop —
          docs/operations/rubric-loop.md.
        </p>
      ) : (
        <p className="empty-state">
          Rubric v{rubric.version} in effect · next distillation due at {rubric.nextDueAt} final
          decisions.
        </p>
      )}

      <h2>Run seeding</h2>
      <p className="empty-state">
        Executes one approved study-related Text Search query (IDs-only field mask; only Place IDs
        are retained). Explicit operator initiation is the only trigger — runs are never scheduled.
      </p>
      <SeedingForm />

      {runs.length > 0 ? (
        <>
          <h2>Recent runs</h2>
          <table className="op-table">
            <thead>
              <tr>
                <th>Template</th>
                <th>Status</th>
                <th>Started</th>
                <th>IDs returned</th>
                <th>Candidates queued</th>
                <th>Attempts accounted</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>{r.queryTemplateId}</td>
                  <td>{r.status}</td>
                  <td>{r.startedAt.slice(0, 16).replace('T', ' ')}</td>
                  <td>{r.resultsCount ?? '—'}</td>
                  <td>{r.candidatesInserted}</td>
                  <td>{r.attemptCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </main>
  )
}
