# Operative decision records — Decisions 10–12: maps and search

## Decision 10 — Map rendering (approved 2026-07-23)

**Direct Google Maps JavaScript API** renders the public map (per GD-1).
MapLibre GL + OpenFreeMap (+ Places UI Kit where applicable) are recorded
as documented cost/portability **fallbacks** — inactive, no launch
dependencies, activation requires a new decision. The GP-1 surface remains
mapless by constraint. Loading mechanism per 24c-G4 (source/11): Google's
official Dynamic Library Import bootstrap; no loader dependency.

## Decision 11 — Tile provider (dissolved)

Closed without selection: Google supplies the launch basemap. OpenFreeMap
remains referenced only inside the documented fallback stack.

## Decision 12 — Search and discovery (approved 2026-07-23, replacing the

earlier geocoding framing; abuse posture approved 2026-07-24)

**Path 1 — café-name search:** resolves entirely against WorkinCafe's
database; published records only; operates live while typing; Google
Autocomplete is never used for café-name suggestions.

**Path 2 — semantic curated-café search:** on explicit submission only —
a Server Action validates and normalizes the descriptive query and
redirects to the canonical URL (`q=`); the Server Component reads `q` and
calls the semantic-search use case directly; results render transiently.
Request bindings: Toronto `locationRestriction`; `regionCode: CA`; field
mask **`places.id` + `nextPageToken` only** (no Google names, addresses,
coordinates, ratings, photos, or reviews in the matching request); no
strict place-type filtering; bounded paging. Returned IDs are intersected
with published WorkinCafe records; only intersections are shown; unmatched
Google businesses never become public results or bypass curation; all
result-card content renders from the canonical database; Google's
relevance order is preserved for the session only — never persisted, never
canonical.

**Selected-result contextual enrichment:** original query retained in
session state; on intentional selection, an optional tightly-scoped Text
Search combines user intent + canonical name + address + Toronto; the
returned Place ID must exactly match before any contextual content is
used; justification, underlying review, and highlighted passage display
with full attribution; nothing persisted; fallback to standard details and
WorkinCafe study information; feature-flagged and experimental; never
required for search results or café pages to function.

**Search-box interaction:** one WorkinCafe-owned interface; local name
matches while typing plus an explicit "Search curated cafés for
'[query]'" action; Text Search runs only on that action or submission —
never per keystroke; no automatic intent classifier.

**Geocoding/Autocomplete:** not approved as launch dependencies. Launch
supports café-name search, semantic search, map panning/zooming,
first-party Toronto neighbourhood quick jumps, and area names inside
descriptive queries. Google Autocomplete or one-shot Geocoding is deferred
pending production evidence that users need exact location navigation.

**Cost posture:** initial semantic matching stays on the Text Search
Essentials IDs-Only SKU wherever current pricing permits. Track
separately: IDs-only semantic searches, contextual enrichment searches,
Place Details requests, photo media requests, map loads. Contextual
enrichment has a dedicated quota and flag, severable without disabling
IDs-only search.

**GET-path abuse posture (16-x-i):** the canonical semantic URL remains
shareable and reloadable, but every execution passes provider-abuse
controls — action-validated submission; minimum/maximum normalized query
lengths; rejection of empty/control-character-heavy/malformed queries;
rate and quota limits before the provider call; in-flight-only
deduplication (no durable result caching); no automatic retry; no internal
links that prefetch semantic URLs; prefetch disabled on triggering links;
semantic-query URLs marked `noindex` at launch; direct navigation to a
valid shared URL executes a fresh search; flag- and quota-disabled states
fall back cleanly to local name search and canonical browsing. Counts and
normalized status are tracked without logging query content or ordered
Place IDs.
