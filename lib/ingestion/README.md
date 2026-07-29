# `lib/ingestion`

Operator-run ingestion/candidate/curation adapters. Never in the request path;
produces review tasks, never auto-publishes.

Slice 2 pt.1 landed:

- `overture-index.ts` — the matching-index refresh orchestrator: consumes an
  extract line stream, validates via `lib/integrations/overture`, batch-upserts
  the internal `overture_places` staging index (idempotent; dry-run; in-batch
  GERS dedup). Staging only — an Overture record alone never becomes a
  candidate.
- `service-area.ts` — the launch-boundary import: PostGIS-validated upsert of
  the Toronto polygon into `service_areas`.

Operator CLIs wrapping these: `tools/ingest-overture.mts`,
`tools/import-service-area.mts` (run via `npm run ingest:overture` /
`import:service-area`); runbook: `docs/operations/ingestion.md`.

Dependency-direction and boundary rules: see `docs/architecture.md` and
`docs/decisions/source/07-application-architecture.md`.
