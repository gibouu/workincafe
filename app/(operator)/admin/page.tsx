import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentOperator } from '@/lib/application/operators/current-operator'
import { listCafesForAdmin } from '@/lib/application/places/list-cafes-admin'
import { hideCafeAction, publishCafeAction } from './actions'
import { LogoutButton } from './logout-button'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const operator = await getCurrentOperator()
  if (!operator) redirect('/login')

  const cafes = await listCafesForAdmin()

  return (
    <main>
      <div className="op-header">
        <h1>Curation console</h1>
        <div>
          <span className="empty-state">{operator.email}</span> <LogoutButton />
        </div>
      </div>
      <div className="op-header">
        <h2>Cafés ({cafes.length})</h2>
        <div className="op-actions">
          <Link href="/gp1">GP-1 queue</Link> <Link href="/admin/new">+ New café</Link>
        </div>
      </div>
      {cafes.length === 0 ? (
        <p className="empty-state">No cafés yet — create the first one.</p>
      ) : (
        <table className="op-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Neighborhood</th>
              <th>Publication</th>
              <th>Record</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cafes.map((cafe) => (
              <tr key={cafe.id}>
                <td>
                  <Link href={`/admin/cafes/${cafe.id}`}>{cafe.name}</Link>
                </td>
                <td>{cafe.neighborhood ?? '—'}</td>
                <td>{cafe.publicationState}</td>
                <td>{cafe.recordState}</td>
                <td>
                  {cafe.recordState === 'active' ? (
                    <div className="op-actions">
                      {cafe.publicationState !== 'published' ? (
                        <form action={publishCafeAction}>
                          <input type="hidden" name="placeId" value={cafe.id} />
                          <button type="submit">Publish</button>
                        </form>
                      ) : null}
                      {cafe.publicationState !== 'hidden' ? (
                        <form action={hideCafeAction}>
                          <input type="hidden" name="placeId" value={cafe.id} />
                          <button type="submit">Hide</button>
                        </form>
                      ) : null}
                    </div>
                  ) : (
                    <span className="empty-state">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}
