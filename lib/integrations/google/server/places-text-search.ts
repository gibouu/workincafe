import 'server-only'
import { z } from 'zod'
import {
  type OutboundAttempt,
  SEEDING_LOCATION_RESTRICTION,
  SEEDING_MAX_PAGES_PER_RUN,
  SEEDING_PAGE_SIZE,
  type SeedingQueryTemplate,
} from '@/lib/domain/seeding-queries'

// Server-only Places Text Search caller for GP-1 seeding (Decisions 9, 12, 16).
// IDs-only by construction: the field mask requests `places.id` (+ page token)
// and the response is validated down to Place IDs — no other Google field ever
// leaves this module. Every request uses `cache: "no-store"`. Accounting is one
// `onAttempt` callback per actual outbound attempt (Text Search Essentials
// IDs-Only SKU), recorded for success AND failure; there is NO automatic retry.
// Raw responses are never logged, thrown, or returned.

const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText'
export const TEXT_SEARCH_SKU = 'places_text_search_ids_only'
const FIELD_MASK = 'places.id,nextPageToken'

// Only these two fields are ever read; anything else in the payload is
// discarded by validation.
const responseSchema = z.looseObject({
  places: z.array(z.looseObject({ id: z.string().min(1) })).optional(),
  nextPageToken: z.string().optional(),
})

export type { OutboundAttempt }

export type TextSearchResult =
  | { status: 'ok'; placeIds: string[]; attempts: number }
  | { status: 'failed'; attempts: number; failedHttpStatus: number | null }

type FetchLike = (url: string, init: RequestInit) => Promise<Response>

export async function searchPlaceIdsForSeeding(
  template: SeedingQueryTemplate,
  apiKey: string,
  onAttempt: (attempt: OutboundAttempt) => Promise<void>,
  fetchImpl: FetchLike = fetch,
): Promise<TextSearchResult> {
  const placeIds: string[] = []
  let pageToken: string | undefined
  let attempts = 0

  for (let page = 0; page < SEEDING_MAX_PAGES_PER_RUN; page++) {
    attempts += 1
    let response: Response
    try {
      response = await fetchImpl(TEXT_SEARCH_URL, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify({
          textQuery: template.textQuery,
          pageSize: SEEDING_PAGE_SIZE,
          locationRestriction: { rectangle: SEEDING_LOCATION_RESTRICTION },
          ...(pageToken ? { pageToken } : {}),
        }),
      })
    } catch {
      // Network failure: the attempt happened — account it; never retry.
      await onAttempt({ sku: TEXT_SEARCH_SKU, httpStatus: null, resultsCount: null })
      return { status: 'failed', attempts, failedHttpStatus: null }
    }

    if (!response.ok) {
      await onAttempt({ sku: TEXT_SEARCH_SKU, httpStatus: response.status, resultsCount: null })
      return { status: 'failed', attempts, failedHttpStatus: response.status }
    }

    let parsed: z.infer<typeof responseSchema>
    try {
      parsed = responseSchema.parse(await response.json())
    } catch {
      await onAttempt({ sku: TEXT_SEARCH_SKU, httpStatus: response.status, resultsCount: null })
      return { status: 'failed', attempts, failedHttpStatus: response.status }
    }

    const pageIds = (parsed.places ?? []).map((p) => p.id)
    await onAttempt({
      sku: TEXT_SEARCH_SKU,
      httpStatus: response.status,
      resultsCount: pageIds.length,
    })
    placeIds.push(...pageIds)

    pageToken = parsed.nextPageToken
    if (!pageToken) break
  }

  return { status: 'ok', placeIds, attempts }
}
