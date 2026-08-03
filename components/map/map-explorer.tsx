'use client'

import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { publicMapHref } from '@/lib/client-state/public-map-url'
import { GoogleMapCanvas, type MapCafePin, type MapsConfig } from './google-map-canvas'

// Bounded MapExplorer feature (Decision 15): map + server-rendered panel and
// list slots. Selection is URL-owned (16-x-ii): a marker click navigates via
// the router (fresh server data → push, creating a back entry); the page
// re-renders the panel from the committed URL. No second selection source of
// truth exists here — this component holds no selection state at all.

export interface ExplorerCafe extends MapCafePin {
  slug: string
}

export function MapExplorer({
  config,
  cafes,
  selectedCafeId,
  panel,
  list,
}: {
  config: MapsConfig
  cafes: ExplorerCafe[]
  selectedCafeId: string | null
  panel: ReactNode
  list: ReactNode
}) {
  const router = useRouter()

  return (
    <div className="map-explorer">
      <GoogleMapCanvas
        config={config}
        cafes={cafes}
        selectedCafeId={selectedCafeId}
        onCafeSelect={(cafeId) => {
          const cafe = cafes.find((c) => c.id === cafeId)
          if (!cafe) return
          router.push(publicMapHref({ selectedCafeSlug: cafe.slug }))
        }}
      />
      {panel}
      {list}
    </div>
  )
}
