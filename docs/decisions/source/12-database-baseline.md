# Operative decision record — Decision 25: database baseline (Step 3B)

Ratified 2026-07-26; strict-gate amendments ratified 2026-07-28. This record is
the authoritative rationale for the Step 3B database baseline; no part of it may
live only in conversation history. It supersedes nothing and is change-controlled
like every operative record. The baseline migration is **immutable after
application** to the canonical database — never permanently frozen in the sense
that the schema can never evolve: forward migrations (expand/contract) carry
every future change, and vocabulary changes are reviewed product + schema
changes, not impossible ones.

## 25a — Canonical entity model

Handwritten Drizzle tables (TS-schema-first, Decision 6), one immutable reviewed
SQL migration (`drizzle/0000_baseline.sql`), the migrated PostgreSQL 17 + PostGIS
database as runtime enforcement authority (ENF-1):

- **places** — no canonical `category`/product-type column (Decision 3):
  eligibility is a human product judgement, not a database enum. Publication
  state (`draft/published/hidden`) and record lifecycle (`active/closed/duplicate`)
  are **separate** dimensions with cross-checks (published ⇒ active; duplicate ⇔
  `duplicate_of_place_id` set; no self-duplicate; closed ⇔ `closed_at` set). No
  generic `closure_source` — closure is a curation decision recorded via events.
  Location is `latitude`/`longitude` (range-checked) plus a database-**generated**
  `geography(Point,4326)` and a GiST index; because it is generated it can never
  drift from lat/lng.
- **service_areas** — `geometry(MultiPolygon,4326)` + GiST; not a hard-coded
  singleton. The authoritative Toronto polygon loads via a reviewed operator
  command, never embedded in the baseline.
- **place_source_refs** — external identity only: `source ∈ {google_places,
overture, toronto_open_data, dinesafe, official_website}`, `external_id`,
  seen-timestamps; `UNIQUE(source, external_id)` and `UNIQUE(place, source,
external_id)`. No provider-payload/JSON column — for `google_places` the
  external id is the Google Place ID and nothing else from any Google response is
  stored (GP-1 IDs-only boundary). `curator`/`community` are provenance, not
  sources, and are absent.
- **attribute_observations / attribute_observation_decisions /
  place_attribute_current** — immutable evidence, append-only review decisions,
  and a current-projection **pointer** (no duplicated value/provenance/confidence).
- **place_hours** — versioned JSONB `WeeklyHoursV1`, `unknown` distinct from
  `closed`, hours never mandatory for publication and never synthesised from
  absence.
- **operators** — WorkinCafe authorization keyed to the Better Auth `user.id`
  (text); an active row grants the single launch operator capability.
- **curation_events** — append-only; structured top-level fields; typed,
  size-bounded `details`; never provider payloads, Google content, query/review
  text, photo ids, error objects, secrets, or personal data.
- Better Auth core tables (`user/session/account/verification`) generated from the
  pinned configuration.

## 25b — Attribute vocabularies (single source of truth in `lib/domain`)

wifi `unknown/none/unreliable/usable/fast`; power `unknown/none/limited/available/
abundant`; noise `unknown/very_quiet/quiet/moderate/lively`; seating
`unknown/none/limited/adequate/ample` (practical study availability, **not**
comfort). Pure domain constants → Zod schemas → text columns + database CHECK
matrix (rejects e.g. wifi/abundant) → UI labels. Every value has an operational
definition. `unknown` is first-class and never converted to `none`.

## 25c — Provenance vocabulary (community excluded — approved)

`provenance_kind ∈ {imported, curator, measurement}`. **`community` is
deliberately excluded from the launch baseline** and this exclusion is approved:
Decision 8 disables public registration, so no community-authored provenance
exists at launch; adding one later is a reviewed forward migration + vocabulary
change. Provenance identity is structurally enforced: imported evidence/hours
require a source reference; curator/measurement evidence and human-entered or
verified hours require an operator identity. Provenance can never be structurally
possible but unidentified.

## 25d — Enforcement split (hybrid)

- **Database (authoritative for structure & history):** CHECK matrix and
  cross-field checks; append-only triggers on observations, decisions, and
  curation events (reject UPDATE/DELETE); provenance-identity CHECKs; the
  current-pointer invariant.
- **Current-pointer invariant** is enforced by **deferred** constraint triggers
  that run from **both** directions — when `place_attribute_current` changes and
  when a decision is appended — validating **final transaction state**. The
  current observation must belong to the same place and kind and have a latest
  effective decision of `accepted`, ordered **solely** by a database-generated
  monotonic decision `seq` (never `decided_at` + UUID). So a later rejection
  cannot leave a rejected observation current, yet rejection + valid repointing
  in one transaction succeeds.
- **Application (owns actor-intent):** provenance precedence lives in the
  `promoteAttributeObservation` use case (pure decision core in `lib/domain`,
  transactional effects through one repository port). Unattended imports never
  silently overwrite curated/measured state; an authorized operator may
  deliberately promote; the current pointer is written by no other code.

## 25e — Migration workflow, generation, and verification

`db:generate` needs no database; `db:migrate` requires `DATABASE_URL_DIRECT` and
fails clearly without it; `drizzle-kit push` is prohibited everywhere and no push
script exists (enforced by governance check + test). Custom SQL (PostGIS
extension, generated geography, GiST, triggers) lives in the same ordered chain,
is reproducible from empty, and is **not** reflected in the Drizzle snapshot
(Decision 6: an empty regeneration diff never proves database equivalence).

The generated-geography expression `ST_SetSRID(ST_MakePoint(lng,lat),4326)::geography`
was **proven** valid + immutable as a STORED generated column in the pinned
local PostgreSQL 17.5 / PostGIS 3.5.2 before adoption (amendment C's primary
path; no trigger fallback needed). Spatial index usability is verified by a
planner check (`enable_seqscan=off`) against a representative proximity query.

## 25f — Better Auth generation rules (preserved)

Generated with the pinned standalone `auth` CLI (version-aligned to `better-auth`)
and `@better-auth/drizzle-adapter`; never `npx auth@latest`; never Better Auth's
direct migration command; no plugins/organization/team/passkey/2FA/SSO/admin
tables. The generated schema is isolated in `lib/db/schema/auth.generated.ts`
(the `.generated` suffix + header make its generated status explicit and keep it
out of Prettier); its content is never hand-edited. `lib/auth/config.ts` (no
`server-only`, CLI-readable) is imported only by `lib/auth/index.ts` and the
generation path — enforced by a boundary test. A future regeneration that
produces an unexplained core-schema diff fails review.

## 25g — Tiering

Tier 1 (in `verify`) covers domain vocabularies, hours/promotion logic, guards,
and boundaries. Tier 2 (local Docker PostGIS, `db:test`) covers migrate-from-empty,
spatial, constraint matrix, append-only, current-pointer (immediate + deferred
bidirectional), decision ordering, provenance identity, hours structure, and the
transactional promotion use case. Tier 2 is convention-enforced (Decision 22);
changing that requires reopening Decision 22.
