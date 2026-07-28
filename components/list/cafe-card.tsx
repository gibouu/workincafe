import Link from 'next/link'
import type { PublishedCafeSummary } from '@/lib/domain/place-view'
import { AttributeChips } from '@/components/place/attribute-chips'

export function CafeCard({ cafe }: { cafe: PublishedCafeSummary }) {
  return (
    <li>
      <Link href={`/cafes/${cafe.slug}`} className="cafe-card">
        <h2>{cafe.name}</h2>
        {cafe.neighborhood ? <p className="neighborhood">{cafe.neighborhood}</p> : null}
        <AttributeChips attributes={cafe.attributes} />
      </Link>
    </li>
  )
}
