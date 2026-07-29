// The decided human-review aid (Decision 9): a Google Maps OUTBOUND link built
// from the Place ID — the operator views the venue on Google's own site. This
// is a plain hyperlink, not a Maps API/loader usage, and involves no Google
// content in our application.
export function mapsOutboundUrl(googlePlaceId: string): string {
  return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(googlePlaceId)}`
}
