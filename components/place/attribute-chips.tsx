import { ATTRIBUTE_KINDS, type AttributeKind, type AttributeValue } from '@/lib/domain/attributes'
import type { CafeAttributes } from '@/lib/domain/place-view'

const KIND_LABELS: Record<AttributeKind, string> = {
  wifi: 'Wi-Fi',
  power: 'Power',
  noise: 'Noise',
  seating: 'Seating',
}

function humanize(value: AttributeValue): string {
  const words = value.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Renders the four study attributes. `unknown` is shown plainly as "Unknown"
 * (muted) — never as a negative. */
export function AttributeChips({ attributes }: { attributes: CafeAttributes }) {
  return (
    <ul className="attr-chips">
      {ATTRIBUTE_KINDS.map((kind) => {
        const value = attributes[kind]
        const isUnknown = value === 'unknown'
        return (
          <li key={kind} className={isUnknown ? 'attr-chip is-unknown' : 'attr-chip'}>
            <span className="attr-name">{KIND_LABELS[kind]}:</span> {humanize(value)}
          </li>
        )
      })}
    </ul>
  )
}
