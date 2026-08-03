# Decision 30 — Venue-website hours extraction + hours-lookup matching

Status: ratified (technical-lead ruling, Cem Gunay, 2026-08-03, in-session;
implemented the same day).

## Ruling

1. **Operator-triggered venue-website hours extraction is approved** as
   tooling assistance to the already-approved official-venue/manual hours
   sourcing model (Decisions 9/28): from the hours form, one click fetches
   **one page — the café's own recorded official website** — and extracts
   **machine-readable schema.org markup only** (JSON-LD
   `openingHoursSpecification` / `openingHours`). No free-text scraping, no
   guessing: anything outside the supported shapes is reported as "open the
   site and read it yourself". The prefill saves through the ordinary
   **curator** path (the operator verified from the official source); no new
   provenance machinery, no schema change.
2. This **amends Decision 28's "no automated venue-site scraping in the
   MVP"** to its intended scope: **bulk, scheduled, or unattended crawling
   remains prohibited** (Decision 19 posture — operator-initiated only);
   a single operator-initiated fetch of the venue's own page, with an
   identifying WorkinCafe User-Agent, bounded time/size, HTML-only, one
   attempt and no retry, is approved.
3. **Instagram and other social platforms are explicitly NOT approved for
   automated collection.** Meta's terms prohibit unauthorized scraping,
   most content is login-walled, and Instagram exposes no structured hours.
   The approved Instagram workflow is manual: the operator opens the page
   themselves and types what they read. Revisiting this requires its own
   decision with a platform-terms review.
4. **Hours-lookup matching (applies to Decision 29's OSM lookup too):**
   lookups score every candidate against the café's canonical name
   (`lib/domain/name-match.ts`) and present "likely match" separated from
   "nearby — reference only"; the OSM query additionally searches same-named
   venues in a wider ring to survive coordinate drift. Matching labels and
   ranks only — nothing is ever auto-applied; the operator confirms every
   prefill.

## Bounds

- Only the URL recorded in `places.website` (operator-entered at creation or
  copied from the café's confirmed Overture match) is ever fetched.
- Extraction conventions mirror the OSM parser (operator-reviewed prefill):
  days the markup never mentions become `closed`; `opens = closes = "00:00"`
  is an explicit closure; seasonal `validFrom`/`validThrough` specifications
  are rejected rather than merged.
- The fetched page is transient: never persisted, never logged.

## Amendment 30b — model-assisted fallback (ratified 2026-08-03, in-session)

When a venue page yields no parseable structured markup, **one inexpensive
model pass may read the visible page text** and produce a prefill schedule:

- Model: `claude-haiku-4-5` (operator cost ruling: lowest/cheapest tier —
  bounded JSON transcription of visible text; the operator verifies every
  prefill, so an extraction miss costs seconds, not correctness).
- Same caller posture as the Decision 27 assist: hand-written fetch,
  `no-store`, one accounting row per actual attempt
  (`anthropic_messages_hours_extract`, `provider_call_attempts`), no
  automatic retry, request/response bodies never logged; fail-closed when
  `ANTHROPIC_API_KEY` is absent (structured-markup extraction and manual
  entry keep working).
- Free-text conventions are more cautious than markup: a day the text does
  not mention prefills `unknown` (never assumed closed); ambiguous,
  conflicting, or seasonal-only text yields nothing. The UI labels AI-read
  prefills distinctly and the operator verifies before the ordinary curator
  save. Amends ruling 1's "reported as open-the-site" for the no-markup
  case only; everything else in this record stands.
- The page text is venue-owned content — the Decision 27 Google-content
  prohibitions are not implicated; the same no-training provider terms
  apply.

## Amends

- Decision 28 (source/15) sourcing note, as in ruling 2.
- Decision 29 (source/16) lookup presentation, as in ruling 4.
- Ruling 1 of this record, per amendment 30b (model-assisted fallback).
