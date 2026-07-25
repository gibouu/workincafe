# Operative decision records — Decision 9, GP-1, GP-2, GD-1…4: place data and Google compliance

## Decision 9 — Permanent café enrichment sources (approved 2026-07-23, amended)

Foundation: **GP-1-led, Overture-enriched hybrid.** Inclusion flow:
(1) GP-1 produces Google Place IDs from approved study-related queries →
(2) a human reviews each candidate → (3) an approved candidate is matched
to an independently sourced Overture record where possible → (4) Overture
supplies legally persistable basic place facts → (5) official venue
sources and manual verification fill or correct → (6) WorkinCafe supplies
and owns study-suitability observations → (7) only reviewed records
publish. Overture is the primary independent enrichment source for basic
facts and stable independent IDs — never the relevance or membership
source. A complete Toronto Overture extraction may exist as an internal
matching index/staging input; bulk import of all café-like records into
the canonical database is not a product requirement; an Overture record
alone never makes a venue a candidate.

- **OSM:** excluded from the canonical place-data layer for the MVP —
  combining it into the canonical café layer would introduce ODbL
  share-alike and attribution obligations that are unnecessary given the
  selected sources. (Basemap/attribution not decided by this entry.)
- **Categories:** "Source categories assist matching and review;
  human-approved product eligibility determines inclusion." No rigid
  category set as an inclusion rule; café-like venues qualify when
  surfaced through an approved candidate source, human-confirmed in scope,
  and genuinely study/work-suitable.
- **Hours:** official-venue/manual recording, structured with first-class
  unknown; never mandatory for publication; unknown acceptable; no
  automated venue-site scraping in the MVP; manual recording captures
  facts only, never expressive text or media; Google hours are outside the
  confirmed workflows and require a separate policy decision; freshness
  thresholds and badge wording belong to product design.
- **Matching:** human-confirmed Google-ID→record matching with a Google
  Maps outbound link and our-side name/proximity suggestions; automated
  high-confidence linking among independent/open sources; medium-
  confidence review queues; **no automatic canonical-record merges.**
- **Precedence & provenance (requirements level):** imports cannot
  silently overwrite human-curated information; conflicting imports create
  review candidates; source, observation date, verification state, and
  relevant licence metadata remain traceable; curator-verified official
  information normally outranks unattended imports. Physical model
  (hierarchies, field-group schemas, staging tables, triggers, conflict
  algorithms) deferred to implementation-time data-model design.
- **FSQ OS Places:** deferred; reconsidered only for a specific missing
  capability. **DineSafe/municipal signals:** existence/licensing/status
  review signals only — absence, changed records, or failed matches never
  auto-close or delete a place; they may only create a human review task.

## GP-1 — Google candidate seeding (confirmed workflow; change-controlled)

Written Google confirmation obtained (workflow submitted 2026-07-21,
confirmed 2026-07-22 per the private record). **Implementation must match
the submitted and confirmed design exactly.** Approved workflow: bounded,
documented study-related Places Text Search queries; IDs-only response
field mask; **of Google-returned data, only Place IDs are retained**; the
result set forms a candidate queue; human review before any candidate
becomes a published café; all permanent café fields independently sourced;
no retention of Google names, addresses, coordinates, hours, ratings,
reviews, photos, contextual content, snippets, or ranking explanations;
WorkinCafe operates as an independently valuable directory; the seeding
tool is a separate, mapless application surface.

Execution: **operator-initiated only** — no schedule, cron, workflow,
application, queue, or page-load trigger; no unattended recurrence. Every
run: explicit authorized-operator initiation, the approved bounded query
set, quota controls, operational accounting, the IDs-only persistence
boundary, and subsequent human review.

Change control: material changes (requesting/retaining non-ID fields,
persisting rankings or relevance explanations, auto-publication, using
Google content to generate permanent attributes, Google data as the source
of permanent fields, redistributing the ID set, expanding beyond
candidate identification) require policy review and potentially a new
Google inquiry, plus recorded approval.

Evidence: the complete correspondence is preserved privately as compliance
evidence. Verification pending; this record makes no claim about its
storage location, and no confidential correspondence or personal contact
details enter the public repository.

## GP-2 — Live display & semantic search (confirmed workflow; change-controlled)

Written Google confirmation obtained (2026-07-24 per the private record).
Approved workflow: user-generated descriptive queries via Places Text
Search (New) with IDs-only matching requests; returned IDs intersected
with published WorkinCafe records; only curated records shown publicly;
unmatched Google businesses never displayed; Google relevance ordering
session-scoped and never persisted as canonical data; public cards render
canonical WorkinCafe/independently sourced information; selected-café
contextual content fetched live with **exact Place-ID match verification**
before use; contextual reviews, justifications, and highlighted passages
display-only and never persisted; all required Google and reviewer
attribution intact; WorkinCafe data and standard Google details remain the
fallback. Same change-control rule as GP-1. Evidence preserved privately;
verification pending on location reference.

## GD-1…GD-4 and flags — public Google architecture (approved 2026-07-23)

- **GD-1:** Architecture A — Google Maps JavaScript API renders the public
  map; WorkinCafe controls its own marker, list-card, and expanded-café
  interfaces; persistent Google storage remains Place IDs only; permanent
  basic facts from approved independent sources; study attributes
  first-party; live Google details/photos/reviews are display-only
  enrichment. Deciding factor recorded: exploring Text Search contextual
  content and study-relevant Google review evidence.
- **GD-2 selected-café flow:** render WorkinCafe content immediately →
  live Place Details (New) → optional tightly-scoped study-oriented Text
  Search (canonical name + address + Toronto) → exact returned-ID match
  required → display contextual justification, underlying review,
  highlighted passage where available → full attribution → no persistence
  → fallback to standard details/WorkinCafe content when absent,
  mismatched, or disabled.
- **GD-3 contextual posture:** experimental feature approved for
  feature-flagged evaluation; never required for pages to function;
  removable without changing the canonical database model; several
  controlled query templates investigated (no single-template assumption);
  query selection isolated in its own module.
- **GD-4 list cards:** one lazily loaded Google photo for a limited number
  of visible cards; no per-card ratings/hours/reviews initially;
  WorkinCafe fallback imagery; removable via feature flag and quota
  controls.
- **Flags (12-flags):** separate flags for semantic search, contextual
  enrichment, and list-card photos — rollout/quota/cost/reliability
  controls, not permission gating (permissions come from the confirmed
  workflows).

## Google-content boundaries (permanent; bind all future adoptions)

Raw Google responses never become canonical writes. Google content never
enters durable caches, analytics, logs, error breadcrumbs, or general
persistence. Required attribution is never separated from displayed Google
content. Billable provider calls remain explicitly controlled, accounted
once per actual outbound attempt, and non-retrying by default. Adopting
any deferred technology never relaxes these rules.
