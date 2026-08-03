import { slugSchema } from '@/lib/domain/places'

// The single typed codec for public-map URL state (Decision 15): the URL is
// the sole source of truth for committed public state — today the selected
// café; the submitted semantic query and committed filters join here with
// their slices. This module owns parameter names, validation, defaults,
// canonical serialization (stable ordering, default omission), and
// unsupported-value rejection; no scattered `URLSearchParams` parsing.
// Never in the URL: Google relevance ordering, contextual content, live
// camera state, drawer animation state.

export const CAFE_PARAM = 'cafe'

export interface PublicMapUrlState {
  /** Selected café slug (URL-owned selection, 16-x-ii); null = none. */
  selectedCafeSlug: string | null
}

export const DEFAULT_PUBLIC_MAP_URL_STATE: PublicMapUrlState = {
  selectedCafeSlug: null,
}

type SearchParamValue = string | string[] | undefined

/** Parse Next.js page searchParams into validated committed state. Repeated or
 * malformed values are rejected to the default, never guessed. */
export function parsePublicMapUrl(params: Record<string, SearchParamValue>): PublicMapUrlState {
  const raw = params[CAFE_PARAM]
  const selectedCafeSlug = typeof raw === 'string' && slugSchema.safeParse(raw).success ? raw : null
  return { selectedCafeSlug }
}

/** Canonical query string: stable ordering, defaults omitted. */
export function serializePublicMapUrl(state: PublicMapUrlState): string {
  const params = new URLSearchParams()
  if (state.selectedCafeSlug !== null) params.set(CAFE_PARAM, state.selectedCafeSlug)
  return params.toString()
}

/** Canonical home href for a committed state (`/` when fully default). */
export function publicMapHref(state: PublicMapUrlState): string {
  const query = serializePublicMapUrl(state)
  return query === '' ? '/' : `/?${query}`
}
