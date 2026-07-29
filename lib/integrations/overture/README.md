# `lib/integrations/overture`

Overture matching-index tooling (internal). Server/CLI only.

Slice 2 pt.1 landed `extract.ts`: pure, fully-validated parsing of one
GeoJSONSeq extract line (the documented external extraction output — see
`docs/operations/ingestion.md`) into the normalized index record defined in
`lib/domain/overture-index`. Structural problems skip a line with a typed
reason; optional-field problems degrade to absent. No IO here — file streaming
lives in the operator CLI, writes in `lib/db/queries/overture-mutations.ts`.

Dependency-direction and boundary rules: see `docs/architecture.md` and
`docs/decisions/source/07-application-architecture.md`.
