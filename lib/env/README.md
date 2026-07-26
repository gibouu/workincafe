# `lib/env`

Environment validation, split server.ts / public.ts. Real Zod-validated modules land with the first feature needing configuration.

Dependency-direction and boundary rules: see `docs/architecture.md` and
`docs/decisions/source/07-application-architecture.md`. No feature code lands
here until its approved vertical slice (Step 4).
