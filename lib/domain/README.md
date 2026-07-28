# `lib/domain`

Pure TypeScript: canonical types, study-attribute/eligibility/provenance/confidence/freshness rules, pure validation. No IO, no framework, no provider, no env imports.

Step 3B landed the single-source vocabularies + Zod schemas + operational
definitions (`attributes.ts`, `provenance.ts`, `places.ts`, `sources.ts`,
`curation.ts`, `hours.ts`) and the pure provenance-precedence decision
(`attribute-promotion.ts`). These are the source of truth mirrored by database
CHECK constraints and consumed by `lib/application`.

Dependency-direction and boundary rules: see `docs/architecture.md` and
`docs/decisions/source/07-application-architecture.md`. Further code lands with
its approved vertical slice (Step 4).
