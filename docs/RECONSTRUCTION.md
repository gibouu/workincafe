# Reconstruction status

**Principle:** one repository, one canonical `main`, one active
architecture, one immutable legacy snapshot
(`archive/pre-reconstruction-2026-07-21`). Long application downtime is
acceptable; accidental repository disorder is not.

## Phase state

- [x] Decision process complete (`docs/decisions/`)
- [x] Step 0 — snapshot, freeze; owner verifications complete (see below)
- [x] Step 1 — governance (merged in #318)
- [x] Step 2A — technology-neutral enforcement (merged in #319)
- [x] Step 2B + 3A — approved skeleton, toolchain, enforcement, and legacy
      strip (merged in #320; combined per the 24b sequencing amendment)
- [x] Step 3B — database baseline merged in #323 (Decisions 25, 26). Schema +
      custom SQL + Better Auth; migrate-from-empty verified on local PostGIS
      across two destroy/recreate cycles; dependency-security disposition gate in
      place. **Applied to canonical Neon on 2026-07-28 via the first production
      build — the migration chain is now frozen** (forward migrations only from
      here; expand/contract per Decision 20).
- [ ] Step 4 — vertical slices (order in source/11, adjustable per 24b)
  - [x] Slice A — public café read path (merged #325). **Deployed** on Vercel
        (Git integration → verify → build → migrate under advisory lock, Decision 20)
        to Neon (project `workincafe`, us-east-1, PG17). Live at `www.workin.cafe`;
        production public; preview builds isolated to a Neon `preview` branch. Deploy
        runbook: `docs/operations/deploy.md`.
  - [x] Slice B — operator write surface (all merged parts deployed to production)
    - [x] Operator auth + gated admin shell (merged #330)
    - [x] Café creation + publish/hide — the Server Action mutation exemplar,
          each record change paired with its append-only curation event in one
          transaction (merged #331)
    - [x] Attribute-observation + hours curation forms — curator evidence
          recording promoted through the sole pointer-writing use case +
          structured-hours upsert paired with `hours_updated`, each in one
          transaction (merged #334)
  - [x] Slice 2 — ingestion + matching + GP-1 candidate queue (first Google
        Place IDs, IDs-only). Approved design (technical-lead rulings,
        2026-07-29): external-extract Overture acquisition (no ingestion
        dependency in-repo); candidate queue with append-only reason-coded
        decisions + versioned non-Google feature snapshots (AI-learning-ready
        label capture; no model, no prediction storage in this slice).
    - [x] pt.1 — Overture matching index + service-area import: validated
          external-extract ingestion CLI, `overture_places` staging table
          (migration 0001), Toronto boundary import (merged #337)
    - [x] pt.2 — candidate queue + append-only reason-coded decisions with
          versioned feature snapshots (label capture per approved design) +
          mapless GP-1 review surface (migration 0002; merged #338)
    - [x] pt.3 — Google Text Search seeding caller: IDs-only field mask,
          per-attempt accounting, no auto-retry, fail-closed without the key
          (merged #339). Operational prerequisite before first real run:
          Google Cloud project with **Places API (New)** enabled + billing +
          restricted server key set as `GOOGLE_PLACES_SERVER_KEY` in Vercel
          (production only)
  - [ ] Remaining slices (source/11 conceptual order, reorderable per 24b):
        public map (Google basemap) · name + semantic search ·
        enrichment / contextual / photos · hardening / verification / docs
    - [x] Map pt.1 — Maps bootstrap adapter + declarative canvas + bounded
          MapExplorer with URL-owned selection + server-rendered café panel;
          fail-closed list-only without the browser key. Operational
          prerequisite before the map renders: referrer-restricted browser
          key (Maps JavaScript API only) + Map ID as
          `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` / `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`
          in Vercel (production only) + redeploy (`docs/operations/deploy.md`)
    - [ ] Map pt.2 — viewport Route Handler (GeoBounds contract) + client
          island fetch after `idle` + list/viewport sync
- [x] **Decision 27 (editorial AI assistance)** ratified #346 (record + verbatim
      Google policy response: `docs/decisions/source/14`; support case number
      still to be added). Implementation: 27a note guidance (#347) · 27b/27c/27f
      AI pre-read (#348, migration 0003) · 27d stored predictions + sequencing
      transparency (#349, migration 0004) · rubric-loop trigger + standing
      procedure (#350, `docs/operations/rubric-loop.md`). **Pending:** 27e
      session queue triage; operational: `ANTHROPIC_API_KEY` in Vercel
      (production) + retain Anthropic no-training terms with compliance records.
      Curation state: operator to review the first 20 candidates WITHOUT the
      pre-read (baseline batch — mechanically tracked on /gp1), then assisted.
- [x] Production operator provisioned on 2026-07-29 via `npm run create-operator`
      against the production database (after the #335 auth-adapter fix — the
      Better Auth drizzle adapter shipped without its schema object, so
      production sign-in had never worked); login verified end-to-end on
      `www.workin.cafe`. Production database contains only that operator —
      no cafés yet, pending curation.

## Owner verifications (Step 0/1)

Confirmed directly by the responsible account holders on **2026-07-28**. Only a
minimal, non-sensitive attestation is recorded here; recovery emails/codes, 2FA
details, registrar payment information, private-settings screenshots, and
per-collaborator role lists are deliberately **not** stored in the repository.

```text
GitHub owner recovery: verified privately by repository owner
Registrar and DNS readiness: verified privately by account holder
Main protection configuration: verified by repository owner
Collaborator access: reviewed and approved by repository owner
Verification date: 2026-07-28
```

`main` branch protection is configured and confirmed appropriate by the
repository owner; this document intentionally does not enumerate the specific
protection rules beyond that confirmation. Governance references to a protected
`main` (AGENTS.md, CONTRIBUTING.md) are backed by this confirmation.

## Interim rules

The legacy application tree has been removed in the Step 2B+3A foundation PR;
its previous state is preserved at the immutable tag. Do not resurrect legacy
code except by porting into the approved structure through a decision-backed
slice PR (cite provenance from the tag). Feature work happens only through
reconstruction slice PRs. The deployed application is a minimal shell until
Step 4 delivers product slices; downtime is acceptable.

## Legacy references

Snapshot tag: `archive/pre-reconstruction-2026-07-21` (commit `cf66a5c`).
Inspect via `git show archive/pre-reconstruction-2026-07-21:<path>`.
Archived docs: `docs/archive/` (historical, never instructions).
Legacy database: sanitized-archive-then-decommission sequence per
source/02 (Decision 5e) and the Step 0 owner checklist. This operational
sequence is tracked separately from the four owner attestations above and is
independent of the greenfield reconstruction database; this document makes no
claim about its current archive/decommission status.
