import type { PublishedCafeDetail } from '@/lib/domain/place-view'
import { AttributeChips } from '@/components/place/attribute-chips'
import { HoursView } from '@/components/place/hours-view'

export function CafeDetail({ cafe }: { cafe: PublishedCafeDetail }) {
  return (
    <article className="cafe-detail">
      <h1>{cafe.name}</h1>
      {cafe.neighborhood ? <p className="neighborhood">{cafe.neighborhood}</p> : null}
      <AttributeChips attributes={cafe.attributes} />
      <dl>
        {cafe.address ? (
          <>
            <dt>Address</dt>
            <dd>{cafe.address}</dd>
          </>
        ) : null}
        {cafe.website ? (
          <>
            <dt>Website</dt>
            <dd>
              <a href={cafe.website} target="_blank" rel="noreferrer noopener">
                {cafe.website}
              </a>
            </dd>
          </>
        ) : null}
        {cafe.phone ? (
          <>
            <dt>Phone</dt>
            <dd>{cafe.phone}</dd>
          </>
        ) : null}
      </dl>
      <h2>Hours</h2>
      <HoursView hours={cafe.hours} />
    </article>
  )
}
