import Link from 'next/link'
import { AttributeChips } from '@/components/place/attribute-chips'
import { publicMapHref } from '@/lib/client-state/public-map-url'
import type { PublishedCafeSummary } from '@/lib/domain/place-view'

// Selected-café panel (Decision 15): selection is URL-owned, so this renders
// server-side from the committed URL with canonical WorkinCafe data only.

export function CafePanel({ cafe }: { cafe: PublishedCafeSummary }) {
  return (
    <aside className="cafe-panel" aria-label={`Selected café: ${cafe.name}`}>
      <div className="op-header">
        <h2>{cafe.name}</h2>
        <Link href={publicMapHref({ selectedCafeSlug: null })} aria-label="Close panel">
          ✕
        </Link>
      </div>
      {cafe.neighborhood ? <p className="neighborhood">{cafe.neighborhood}</p> : null}
      <AttributeChips attributes={cafe.attributes} />
      <p>
        <Link href={`/cafes/${cafe.slug}`}>Full details →</Link>
      </p>
    </aside>
  )
}
