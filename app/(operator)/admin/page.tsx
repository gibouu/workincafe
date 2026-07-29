import { redirect } from 'next/navigation'
import { getCurrentOperator } from '@/lib/application/operators/current-operator'
import { listCafesForAdmin } from '@/lib/application/places/list-cafes-admin'
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
      <h2>Cafés ({cafes.length})</h2>
      {cafes.length === 0 ? (
        <p className="empty-state">No cafés yet — creation lands in the next slice.</p>
      ) : (
        <table className="op-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Neighborhood</th>
              <th>Publication</th>
              <th>Record</th>
            </tr>
          </thead>
          <tbody>
            {cafes.map((cafe) => (
              <tr key={cafe.id}>
                <td>{cafe.name}</td>
                <td>{cafe.neighborhood ?? '—'}</td>
                <td>{cafe.publicationState}</td>
                <td>{cafe.recordState}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}
