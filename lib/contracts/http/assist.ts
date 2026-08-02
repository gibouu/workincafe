import type { AssistBrief } from '@/lib/domain/assist'

// Browser-safe wire contract for the AI pre-read action (Decision 27b/27f).
// Everything here is SESSION-ONLY: live-fetched Google content for attributed
// display plus the transient model brief. None of it is ever persisted, and
// the required attribution fields travel WITH the content so display can never
// separate them (obligations: attribution survives DTO mapping).

export interface DisplayReview {
  // Operator-facing assessment context — displayed with author attribution.
  text: string
  relativeTime: string | null
  authorName: string
  authorUri: string | null
  authorPhotoUri: string | null
}

export interface PlaceDisplay {
  name: string
  address: string | null
  rating: number | null
  userRatingCount: number | null
  googleMapsUri: string | null
  reviewSummary: string | null
  generativeSummary: string | null
  summaryDisclosure: string | null
  reviews: DisplayReview[]
  photoCount: number
}

export interface AssistResult {
  display: PlaceDisplay
  brief: AssistBrief
}
