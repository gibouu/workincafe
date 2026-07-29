# `app/(operator)/gp1`

Auth-gated, MAPLESS candidate-seeding surface (GP-1). Must never import map
components, the Maps loader, or the browser Maps key (Decision 13d; enforced by
ESLint and `tests/boundaries/gp1-mapless.test.ts`).

Slice 2 pt.2 landed the review surface: FIFO candidate queue (`page.tsx`) and
per-candidate review (`candidates/[id]/`) — Google Maps outbound link built
from the Place ID (`maps-link.ts`), our-side Overture suggestion search via a
GET form (URL-committed, session-only query), and approve/reject/defer Server
Actions over the `decideCandidate` use case. Candidates are Google Place IDs
only; approval creates a DRAFT café (publication stays a separate curation
act). The seeding trigger itself (operator-initiated Text Search, IDs-only)
lands in pt.3.

Dependency-direction and boundary rules: see `docs/architecture.md` and
`docs/decisions/source/07-application-architecture.md`.
