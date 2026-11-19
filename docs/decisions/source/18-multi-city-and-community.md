# Decision 31 — France + Canada, curated base then community, 30-second feedback

Status: **proposed** (product owner, 2026-11-12). Becomes ratified when the
technical lead (Cem Gunay) approves the pull request that carries this record;
until then the previous scope stays in force and nothing here may be built.

## Ruling

### 31a — Two countries: France and Canada

1. WorkinCafe launches in **France and Canada**, starting with **Paris** and
   **Toronto**. "Toronto-only" is SUPERSEDED as a product invariant (product
   scope, deferred register §F).
2. The product is organised by **country, then city**. A city is a
   **service area** (the `service_areas` table already holds more than one
   area) with its own boundary polygon, time zone (`Europe/Paris`,
   `America/Toronto`), default map centre and GP-1 seeding query set
   (French-language queries in France).
3. **Adding a city inside France or Canada** (Lyon, Montréal…) is a curation
   step: import its boundary, curate its base of ~100 cafés. It needs no new
   scope decision. **Adding a country** is a new decision.
4. Country-specific sources stay country- or city-specific: Toronto Open
   Data and DineSafe apply to Toronto only. French equivalents need their own
   source decision.

### 31b — Curated base of ~100 cafés per city, then the community

1. Each new city opens with a **curated base of about 100 cafés**, selected
   through the existing curation system (GP-1 candidate queue, append-only
   reason-coded decisions, editorial AI pre-read, hours-required
   publication). Quality over count, as before; bulk import stays prohibited.
2. **Paris seed:** the product owner's personal list of ~40 cafés she knows
   first-hand enters the candidate queue first, then GP-1 completes the base.
3. **After the base, people add their own cafés.** A signed-in user can
   suggest a café; the suggestion becomes a **candidate in the existing
   queue** with a new candidate source `community`, and goes through the same
   human review, rubric and reject reasons as GP-1 candidates.
   **Publication remains a curated human decision** (§F rule unchanged).

### 31c — Rating and recommendation, in 30 seconds

Any signed-in user can leave feedback on a published café. The whole form
must take **30 seconds or less**: one screen, taps only, no required text.

| Step | Question                         | Answer                                   |
| ---- | -------------------------------- | ---------------------------------------- |
| 1    | Overall rating                   | 1–5 stars (required)                     |
| 2    | Would you recommend it for work? | Yes / No (required)                      |
| 3    | Wi-Fi                            | None or unusable · Works · Fast · (skip) |
| 4    | Power outlets                    | None · A few · Everywhere · (skip)       |
| 5    | Noise                            | Calm · Some chatter · Loud · (skip)      |
| 6    | Tables / seating                 | Hard to get · OK · Plenty · (skip)       |
| 7    | One line (optional)              | Free text, short limit                   |

- Steps 3–6 default to **skip = unknown**; skipping never records a
  negative (unknown ≠ negative stands).
- The three choices map onto the **existing attribute vocabularies** — no
  vocabulary change: Wi-Fi `none` / `usable` / `fast`; power `none` /
  `limited` / `abundant`; noise `quiet` / `moderate` / `lively`; seating
  `limited` / `adequate` / `ample`.
- **Removed from the user path** (kept for operators only): confidence
  level, evidence/source fields, reason codes, required notes, hours entry,
  the full 4–5-level scales.
- Answers to steps 3–6 are stored as **attribute observations with a new
  provenance kind `community`**, append-only like every observation.
  Community observations **never overwrite a curator value automatically**;
  promotion to a café's current value stays a curator decision (or a later
  rule-based threshold decision).
- The café page shows the community signal next to the curated attributes,
  e.g. "4.6 ★ · 92 % recommend it for work · 38 reviews". WorkinCafe ratings
  are our own content and are never mixed with or derived from Google ratings
  (Google-content boundaries in §F stand).

## Amends

- **Product scope:** "Toronto only", "public registration or accounts" and
  "community reviews/observations" leave the do-not-build list.
- **Decision 8:** public sign-up is enabled for contributors. Browsing stays
  anonymous; an account is required only to suggest a café or leave
  feedback (abuse control). Operator authorization stays separate and
  explicit.
- **Decisions 3 / 25:** provenance vocabulary gains `community` (reviewed
  forward migration, expand/contract per Decision 20).
- **Decision 9 / GP-1:** the candidate queue gains a `community` candidate
  source; GP-1's Google IDs-only rules are unchanged.

## Still out of scope (each needs its own decision)

Friends and "come work with me" sessions; drink categories (coffee only /
coffee + matcha / tea, juice and others); notifications and email; photos
hosted by us; a third country; native apps.

## Implementation follow-ups (not approved by this record alone — planned slices)

Country and city switcher; per-city map centre, time zone and seeding
queries (currently hard-coded to
Toronto in `map-controller.ts`, `hours.ts`, `seeding-queries.ts`); Paris
service-area polygon import; public sign-up flow; `community` provenance +
candidate source migration; feedback form and aggregate display.
