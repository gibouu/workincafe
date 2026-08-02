# Decision 28 — Hours required for publication

Status: ratified (technical-lead ruling, Cem Gunay, 2026-08-02, in-session;
implemented the same day).

## Ruling

A café may transition to `published` only when a `place_hours` record exists
whose seven days are all known — each day either `closed` or `open` with
intervals; any `unknown` day blocks publication. Hiding is never gated.
Enforcement lives in the publication-transition write
(`lib/db/queries/cafe-mutations.ts`) and is surfaced in the curation console
("needs hours to publish").

This amends the hours-optional stance of Decisions 3, 9, and 25 ("hours never
mandatory for publication"). Unchanged: `unknown` remains first-class and
distinct from `closed`; hours are never synthesised from absence; the approved
sourcing model remains official-venue/manual recording (no Google hours —
still outside the confirmed workflows; no automated venue-site scraping in the
MVP). Rationale: verified hours are core to the product promise ("can I go
work there now?"); requiring them keeps the published set trustworthy and
keeps hours an owned-data asset rather than a live provider dependency.

## Future sourcing options (recorded, not adopted)

- OpenStreetMap `opening_hours` (ODbL; attribution + share-alike review) — the
  best programmatic candidate; would need a provenance decision + new source
  kind.
- Community-reported hours — post-launch, behind the community-observations
  scope decision.
- Google hours — would require its own policy inquiry; factual transcription
  is not covered by the Decision 27 judgment-note reasoning.
