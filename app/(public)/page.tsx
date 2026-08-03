import { CafeCard } from '@/components/list/cafe-card'
import { CafePanel } from '@/components/map/cafe-panel'
import { MapExplorer } from '@/components/map/map-explorer'
import { listPublishedCafes } from '@/lib/application/places/list-published-cafes'
import { parsePublicMapUrl } from '@/lib/client-state/public-map-url'
import { mapsBrowserConfig } from '@/lib/env/public'

// Canonical reads are uncached at launch (Decision 16): render per request.
// The map explorer (Decision 15) reads its committed state — the selected
// café — from the URL; without a browser Maps credential the page fails
// closed to the list-only experience (Decision 20 flags-off posture).
export const dynamic = 'force-dynamic'

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const state = parsePublicMapUrl(await searchParams)
  const cafes = await listPublishedCafes()
  const config = mapsBrowserConfig()
  const selected = state.selectedCafeSlug
    ? (cafes.find((cafe) => cafe.slug === state.selectedCafeSlug) ?? null)
    : null

  const list =
    cafes.length === 0 ? (
      <p className="empty-state">No published cafés yet.</p>
    ) : (
      <ul className="cafe-list">
        {cafes.map((cafe) => (
          <CafeCard key={cafe.id} cafe={cafe} />
        ))}
      </ul>
    )

  return (
    <main>
      <h1>WorkinCafe</h1>
      <p>Toronto cafés suitable for studying or working.</p>
      {config ? (
        <MapExplorer
          config={config}
          cafes={cafes.map((cafe) => ({
            id: cafe.id,
            slug: cafe.slug,
            name: cafe.name,
            latitude: cafe.latitude,
            longitude: cafe.longitude,
          }))}
          selectedCafeId={selected?.id ?? null}
          panel={selected ? <CafePanel cafe={selected} /> : null}
          list={list}
        />
      ) : (
        list
      )}
    </main>
  )
}
