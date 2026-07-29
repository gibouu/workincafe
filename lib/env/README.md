# `lib/env`

Environment validation, split server.ts / public.ts (Decision 17).

`server.ts` — lazy, memoized, Zod-validated server env (`DATABASE_URL`; optional feature-conditional `GOOGLE_PLACES_SERVER_KEY` for GP-1 seeding — absent key fails that path closed, nothing else demands it).
Validated at request time, never at build (the public read routes are
force-dynamic). Never imported by Client Components or browser-safe modules
(ESLint boundary) — it may reference secrets. `public.ts` (browser-safe public
env) lands with the first slice that needs a public value.

Dependency-direction and boundary rules: see `docs/architecture.md` and
`docs/decisions/source/07-application-architecture.md`.
