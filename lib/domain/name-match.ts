// Venue-name matching for hours-source lookups (Decision 30). Pure and
// deliberately simple: normalization + exact/containment/token-overlap tiers.
// A lookup NEVER auto-applies on a name match — matching only ranks and labels
// candidates so the operator can tell "this is the café" from "this is merely
// nearby"; the operator confirms every application.

const COMBINING_MARKS = /[̀-ͯ]/g

function normalizeTokens(name: string): string[] {
  return (
    name
      .normalize('NFD')
      .replace(COMBINING_MARKS, '')
      .toLowerCase()
      .match(/[a-z]+|\d+/g) ?? []
  )
}

export type NameMatch = 'match' | 'close' | 'other'

/** Compare a café's canonical name with a candidate venue name. */
export function scoreNameMatch(cafeName: string, candidateName: string | null): NameMatch {
  if (candidateName === null) return 'other'
  const a = normalizeTokens(cafeName)
  const b = normalizeTokens(candidateName)
  if (a.length === 0 || b.length === 0) return 'other'
  const aJoined = a.join('')
  const bJoined = b.join('')
  if (aJoined === bJoined) return 'match'
  if (
    aJoined.length >= 4 &&
    bJoined.length >= 4 &&
    (aJoined.includes(bJoined) || bJoined.includes(aJoined))
  ) {
    return 'close'
  }
  const aSet = new Set(a)
  const bSet = new Set(b)
  let shared = 0
  for (const token of aSet) if (bSet.has(token)) shared++
  const jaccard = shared / (aSet.size + bSet.size - shared)
  return jaccard >= 0.5 ? 'close' : 'other'
}

/**
 * Case-insensitive OSM name-tag regex for a café name, tolerant of separator
 * differences ("Cafe23" matches "Cafe 23", "cafe-23"). Null when the name has
 * no usable tokens. Letter/digit runs are the atoms; anything between them in
 * the tag is allowed to vary.
 */
export function osmNamePattern(cafeName: string): string | null {
  const runs = cafeName
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .match(/[A-Za-z]+|\d+/g)
  if (!runs || runs.length === 0) return null
  return runs.join('[^A-Za-z0-9]*')
}
