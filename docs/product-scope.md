# WorkinCafe — Product Scope (binding)

WorkinCafe helps students and remote workers find Toronto cafés suitable
for studying or working ("study" covers both). Authority: operative
decision records (Decisions 3, 9, GD-1…4, 24c-G5).

## In scope at launch

- Anonymous public experience: Google Map + curated café list, café detail
  view, café-name search (our database), semantic curated-café search
  (Google IDs-only matching against published records), selected-café live
  Google enrichment (details; flag-gated contextual review evidence;
  flag-gated list-card photos), external directions.
- WorkinCafe-owned study attributes: Wi-Fi, noise, power outlets, seating —
  with provenance, confidence, freshness, and unknown ≠ negative.
- Operator surfaces (auth-gated, controlled operator accounts): curation
  admin (create/edit/publish/unpublish/merge-review), mapless GP-1
  candidate seeding, candidate review queues. Public registration remains
  disabled.
- Toronto only. Launch boundary: City of Toronto.

## Launch curation target

The initial launch target is approximately 100 carefully curated Toronto
cafés. Quality, attribute completeness, provenance and useful geographic
coverage take priority over hitting an exact count. Launching with somewhat
fewer is acceptable when the experience is coherent and the approved
coverage areas are useful. Expansion occurs only through the human-review
curation workflow. Bulk canonical import to hit a numerical target is
prohibited.

## Explicitly not in scope at launch (do-not-build list)

Public registration or accounts; community reviews/observations (schema is
shaped for them; no UI); photos hosted by us; payments, deals, loyalty,
owner claims; social features; multi-city anything; native mobile apps;
libraries/coworking/other venue categories as canonical product types;
analytics dashboards; notifications; email.

Items here require a recorded scope decision — not a PR, not an agent
initiative. Deferred *technologies* live in
`docs/decisions/deferred-register.md`.

## Product semantic invariants

Unknown remains distinct from negative · provenance/confidence/freshness
are always represented · observation history is append-only · publication
is a curated human decision · Toronto-only.
