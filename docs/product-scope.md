# WorkinCafe — Product Scope (binding)

WorkinCafe helps freelancers, remote workers and students find cafés in
**France and Canada** (starting with Paris and Toronto) where they can
actually work: Wi-Fi, power outlets,
calm, and tables. ("Study" covers both studying and working.) Authority:
operative decision records (Decisions 3, 9, GD-1…4, 24c-G5, 31, 32, 33).

> Decisions 31, 32 and 33 are **proposed** (2026-11-12) and take effect when the
> technical lead ratifies them. Until then the Toronto-only, no-accounts scope
> of the previous version of this file stays in force.

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
  candidate seeding, candidate review queues.
- **Two countries: France and Canada** (Decision 31a), starting with Paris
  and Toronto. The product is organised by country, then city. Each city
  is a service area with its own boundary, time zone, map centre and
  seeding queries. Launch boundaries: Ville de Paris; City of Toronto. A new city
  inside France or Canada is a curation step; a new country needs a decision.
- **Contributor accounts** (Decision 31): browsing stays anonymous; signing
  up is needed only to suggest a café or leave feedback.
- **Community café suggestions** (Decision 31b): a suggestion enters the
  existing candidate queue (`community` source) and goes through the same
  human review before any publication.
- **30-second feedback** (Decision 31c): 1–5 star rating + "recommend it
  for work?" + four optional one-tap attribute answers + optional one line.
  Stored as append-only `community` observations; never auto-overwrites a
  curated value.
- **Cosy seasonal interface** (Decision 32a): neutral beige identity that
  re-themes itself automatically by season (autumn, Halloween, a garnet and
  wine autumn-to-Christmas season in November, Christmas, winter, spring,
  summer), with motion that respects reduced-motion settings.
- **WorkinCafe in people's AI** (Decision 32b): a public MCP server and a
  "Connect your AI" button. Anyone can search cafés from Claude, ChatGPT or
  Codex; signed-in people can leave feedback, suggest a café and attach a
  photo, all through the same reviewed path as the site.
- **Book Club** (Decision 33): cafés that hosted the Book Club carry a
  badge and their Luma event link; Luma stays the event system.
- Launch audience: about 10 people. Build proportionately.

## Launch curation target

Each city opens with a **curated base of approximately 100 cafés**. In
Paris, the product owner's personal list (~40 cafés known first-hand) is
reviewed first, then GP-1 seeding completes the base. Quality, attribute
completeness, provenance and useful geographic coverage take priority over
hitting an exact count; launching with somewhat fewer is acceptable when the
experience is coherent. Beyond the base, **the community adds cafés**
through suggestions, and every addition still goes through human review.
Bulk canonical import to hit a numerical target is prohibited.

## Explicitly not in scope at launch (do-not-build list)

Friends, "come work with me" sessions and other social features; drink
categories; photos hosted by us other than reviewed photos on community
contributions; payments, deals, loyalty, owner claims;
countries beyond France and Canada; native mobile apps;
libraries/coworking/other venue categories as canonical product types;
analytics dashboards; notifications; email.

Items here require a recorded scope decision — not a PR, not an agent
initiative. Deferred _technologies_ live in
`docs/decisions/deferred-register.md`.

## Product semantic invariants

Unknown remains distinct from negative · provenance/confidence/freshness
are always represented · observation history is append-only · publication
is a curated human decision · community input never silently overwrites
curated state · launch countries: France and Canada.
