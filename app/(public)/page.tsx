import { CafeCard } from '@/components/list/cafe-card'
import { listPublishedCafes } from '@/lib/application/places/list-published-cafes'

// Canonical reads are uncached at launch (Decision 16): render per request.
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const cafes = await listPublishedCafes()
  return (
    <main>
      <h1>WorkinCafe</h1>
      <p>Toronto cafés suitable for studying or working.</p>
      {cafes.length === 0 ? (
        <p className="empty-state">No published cafés yet.</p>
      ) : (
        <ul className="cafe-list">
          {cafes.map((cafe) => (
            <CafeCard key={cafe.id} cafe={cafe} />
          ))}
        </ul>
      )}
    </main>
  )
}
