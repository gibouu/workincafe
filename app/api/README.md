# `app/api`

Thin Route Handlers for interactive client reads only (viewport, selected-café enrichment, card photos). Parse/validate -> one use case -> approved DTO + headers.

Dependency-direction and boundary rules: see `docs/architecture.md` and
`docs/decisions/source/07-application-architecture.md`. No feature code lands
here until its approved vertical slice (Step 4).
