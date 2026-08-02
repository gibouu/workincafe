# Decision 29 — OSM opening_hours as an operator-confirmed hours source

Status: ratified (technical-lead ruling, Cem Gunay, 2026-08-02, in-session;
implemented the same day). Investigation record: issue #361.

## Ruling

OpenStreetMap `opening_hours` is adopted as a **prefill source** for the
café hours form, under the following bounds:

1. **Overpass API** (public instance, `overpass-api.de`) is approved as a
   hosted lookup service for this use only: operator-triggered from the
   curation console, no API key, single attempt, no automatic retry, never
   scheduled, never fired by page load. Requests identify themselves with a
   WorkinCafe User-Agent per OSM operations policy. Overpass is free; no
   billable-call accounting applies.
2. **Source kind `osm`** is added to the `place_source_refs` vocabulary. The
   external id is the OSM element identity (`node/<id>` or `way/<id>`) — an
   identity reference only, never a payload store.
3. **Provenance is honest.** Hours applied from an OSM lookup save as
   `imported` provenance with the `osm` source reference,
   `observed_at` = the OSM element's last-edit timestamp, and the operator's
   verification stamp (`verified_at`/`verified_by`). The record remains
   OSM-derived even when the operator corrects fields before saving
   (conservative for ODbL attribution). A later save without an OSM
   application returns the record to `curator` provenance and clears the
   source reference. One OSM element links to one café; a second café
   claiming the same element is rejected for human review.
4. **Parsing is conservative.** A hand-written subset parser
   (`lib/domain/osm-hours.ts`) handles the common value shapes; anything
   outside the subset is shown raw for manual entry — never guessed. Days a
   value does not mention prefill as `closed`, which is the `opening_hours`
   specification's own semantics (the value states when the venue is open),
   not a WorkinCafe inference from absence; the operator reviews every
   prefill before saving. No `opening_hours` parser dependency is adopted.
5. **ODbL obligations.** Attribution ("Hours data © OpenStreetMap
   contributors, ODbL") accompanies every surface that displays OSM-derived
   hours — the curation lookup panel today, and any future public surface
   that shows hours whose provenance is the `osm` source (this binds the
   public UI slice). Share-alike posture: OSM-derived hours rows remain
   clearly separable via their source references (collective-database
   position), and WorkinCafe will make the OSM-derived hours data available
   on request.

## Scope limits

- **Decision 9's exclusion of OSM as a canonical place-data layer stands**
  (deferred register §E). This decision adopts OSM for hours prefill only —
  no OSM names, categories, geometries, or identities enter the canonical
  place model beyond the hours source reference.
- The changed fact justifying adoption is **Decision 28** (hours required
  for publication), which created a concrete, demonstrated need for a
  programmatic hours source. Coverage measured 2026-08-02: 27% of
  `amenity=cafe` elements in the service-area bbox carry `opening_hours`
  (498 of 1,814).
- Bulk/scheduled OSM ingestion, an OSM hours refresh CLI, and community
  hours reporting remain separate future proposals (Decision 19 posture;
  Decision 28 record).

## Amends

- Decision 9 / Decision 28 sourcing model: approved hours sourcing is now
  official-venue/manual **or OSM-assisted operator-confirmed prefill**.
  Unchanged: `unknown` stays first-class; hours are never synthesised from
  absence; no Google hours (their own walls — see Decision 28 record and
  issue #360); no automated venue-site scraping.
