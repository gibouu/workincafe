# `lib/integrations/google/server`

Server-only Google Places: Details/Text Search/contextual callers, exact field masks, ID matching, accounting, provider->display-DTO mapping, attribution composition.

Slice 2 pt.3 landed `places-text-search.ts`: the GP-1 seeding Text Search
caller — `server-only`; IDs-only field mask (`places.id,nextPageToken`);
response validated down to Place IDs so no other Google field ever leaves the
module; every request `cache: "no-store"`; one accounting callback per actual
outbound attempt (success and failure), no automatic retry; raw responses never
logged or returned. Decision 27 added
`place-details.ts`: the pre-read Details + photo-media caller — live-only,
attributed display DTO (attribution travels with content), no hours fields,
per-attempt accounting, no retry. Later slices add the contextual callers.

Dependency-direction and boundary rules: see `docs/architecture.md` and
`docs/decisions/source/07-application-architecture.md`.
