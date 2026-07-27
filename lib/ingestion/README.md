# `lib/ingestion`

Operator-run ingestion/candidate/curation adapters. Never in the request path; produces review tasks, never auto-publishes.

Dependency-direction and boundary rules: see `docs/architecture.md` and
`docs/decisions/source/07-application-architecture.md`. No feature code lands
here until its approved vertical slice (Step 4).
