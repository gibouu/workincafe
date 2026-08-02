import 'server-only'
import { z } from 'zod'
import type { OutboundAttempt } from '@/lib/domain/seeding-queries'
import type { DisplayReview, PlaceDisplay } from '@/lib/contracts/http/assist'

// Server-only Place Details caller for the Decision 27 editorial pre-read.
// Live-fetch only (`no-store`); the response is validated down to the display
// DTO (attribution fields travel with the content) and the assist inputs.
// Nothing here is ever persisted or logged; one accounting callback per actual
// outbound attempt; no automatic retry. Hours are deliberately NOT requested —
// Google hours remain outside the confirmed workflows (source/05).

export const PLACE_DETAILS_SKU = 'places_details_pro_enterprise'
export const PLACE_PHOTO_SKU = 'places_photo_media'
const FIELD_MASK =
  'id,displayName,formattedAddress,rating,userRatingCount,googleMapsUri,reviews,photos,generativeSummary,reviewSummary'

const MAX_REVIEWS = 5
const MAX_PHOTOS = 3
const PHOTO_MAX_PX = 1024

const detailsSchema = z.looseObject({
  id: z.string().optional(),
  displayName: z.looseObject({ text: z.string().optional() }).nullish(),
  formattedAddress: z.string().nullish(),
  rating: z.number().nullish(),
  userRatingCount: z.number().nullish(),
  googleMapsUri: z.string().nullish(),
  generativeSummary: z
    .looseObject({
      overview: z.looseObject({ text: z.string().optional() }).nullish(),
      disclosureText: z.looseObject({ text: z.string().optional() }).nullish(),
    })
    .nullish(),
  reviewSummary: z
    .looseObject({
      text: z.looseObject({ text: z.string().optional() }).nullish(),
      disclosureText: z.looseObject({ text: z.string().optional() }).nullish(),
    })
    .nullish(),
  reviews: z
    .array(
      z.looseObject({
        text: z.looseObject({ text: z.string().optional() }).nullish(),
        relativePublishTimeDescription: z.string().nullish(),
        authorAttribution: z
          .looseObject({
            displayName: z.string().nullish(),
            uri: z.string().nullish(),
            photoUri: z.string().nullish(),
          })
          .nullish(),
      }),
    )
    .nullish(),
  photos: z.array(z.looseObject({ name: z.string() })).nullish(),
})

export interface PlaceAssistContent {
  display: PlaceDisplay
  photoNames: string[]
}

export type PlaceDetailsResult =
  { status: 'ok'; content: PlaceAssistContent } | { status: 'failed'; httpStatus: number | null }

type FetchLike = (url: string, init: RequestInit) => Promise<Response>

export async function fetchPlaceAssistContent(
  googlePlaceId: string,
  apiKey: string,
  onAttempt: (attempt: OutboundAttempt) => Promise<void>,
  fetchImpl: FetchLike = fetch,
): Promise<PlaceDetailsResult> {
  let response: Response
  try {
    response = await fetchImpl(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(googlePlaceId)}`,
      {
        method: 'GET',
        cache: 'no-store',
        headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELD_MASK },
      },
    )
  } catch {
    await onAttempt({ sku: PLACE_DETAILS_SKU, httpStatus: null, resultsCount: null })
    return { status: 'failed', httpStatus: null }
  }

  if (!response.ok) {
    await onAttempt({ sku: PLACE_DETAILS_SKU, httpStatus: response.status, resultsCount: null })
    return { status: 'failed', httpStatus: response.status }
  }

  let parsed: z.infer<typeof detailsSchema>
  try {
    parsed = detailsSchema.parse(await response.json())
  } catch {
    await onAttempt({ sku: PLACE_DETAILS_SKU, httpStatus: response.status, resultsCount: null })
    return { status: 'failed', httpStatus: response.status }
  }
  await onAttempt({ sku: PLACE_DETAILS_SKU, httpStatus: response.status, resultsCount: 1 })

  const reviews: DisplayReview[] = (parsed.reviews ?? []).slice(0, MAX_REVIEWS).flatMap((r) => {
    const text = r.text?.text?.trim()
    const authorName = r.authorAttribution?.displayName?.trim()
    // Attribution is required — a review without an author never displays.
    if (!text || !authorName) return []
    return [
      {
        text,
        relativeTime: r.relativePublishTimeDescription ?? null,
        authorName,
        authorUri: r.authorAttribution?.uri ?? null,
        authorPhotoUri: r.authorAttribution?.photoUri ?? null,
      },
    ]
  })

  const photoNames = (parsed.photos ?? []).slice(0, MAX_PHOTOS).map((p) => p.name)

  return {
    status: 'ok',
    content: {
      display: {
        name: parsed.displayName?.text ?? '(name unavailable)',
        address: parsed.formattedAddress ?? null,
        rating: parsed.rating ?? null,
        userRatingCount: parsed.userRatingCount ?? null,
        googleMapsUri: parsed.googleMapsUri ?? null,
        reviewSummary: parsed.reviewSummary?.text?.text ?? null,
        generativeSummary: parsed.generativeSummary?.overview?.text ?? null,
        summaryDisclosure:
          parsed.reviewSummary?.disclosureText?.text ??
          parsed.generativeSummary?.disclosureText?.text ??
          null,
        reviews,
        photoCount: photoNames.length,
      },
      photoNames,
    },
  }
}

export interface FetchedPhoto {
  mediaType: string
  base64: string
}

/** Live-fetch one photo's media for transient model input (never stored). */
export async function fetchPhotoMedia(
  photoName: string,
  apiKey: string,
  onAttempt: (attempt: OutboundAttempt) => Promise<void>,
  fetchImpl: FetchLike = fetch,
): Promise<FetchedPhoto | null> {
  let response: Response
  try {
    response = await fetchImpl(
      `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${PHOTO_MAX_PX}&maxHeightPx=${PHOTO_MAX_PX}&key=${encodeURIComponent(apiKey)}`,
      { method: 'GET', cache: 'no-store', headers: {} },
    )
  } catch {
    await onAttempt({ sku: PLACE_PHOTO_SKU, httpStatus: null, resultsCount: null })
    return null
  }
  await onAttempt({
    sku: PLACE_PHOTO_SKU,
    httpStatus: response.status,
    resultsCount: response.ok ? 1 : null,
  })
  if (!response.ok) return null

  const mediaType = response.headers.get('content-type') ?? 'image/jpeg'
  if (!/^image\/(jpeg|png|gif|webp)$/.test(mediaType)) return null
  const bytes = Buffer.from(await response.arrayBuffer())
  return { mediaType, base64: bytes.toString('base64') }
}
