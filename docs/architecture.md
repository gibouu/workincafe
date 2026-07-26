# Architecture (target — implemented from Step 2B)

Status: SKELETON. This file becomes the implemented map during Step 2B;
until then the authoritative sources are the operative decision records
(13, 15, 16, 17, 18) under `docs/decisions/source/`. The legacy tree does
not follow this architecture and is scheduled for removal (Step 3A).

## Target structure (Decision 13a — no `src/`)

app/(public) · app/(operator)/{admin,gp1} · app/api ·
components/{ui,map,list,place,search,admin,gp1} ·
lib/{domain,application,db,auth,integrations/google/{client,server},
integrations/overture,ingestion,flags,contracts/http,env,client-state} ·
scripts · drizzle · tests/{unit,contracts,boundaries,compliance,integration}
· docs

## Dependency directions (lint-enforced; Decision 13b)

domain → nothing · db / auth-server / google-server / overture / ingestion
→ domain · application → domain + narrow infrastructure · google/client →
browser-safe shared types · components → domain types + application DTOs +
google/client (map only) · app → application + components + approved auth
entry points · scripts → application/ingestion.

Prohibitions (full list in source/07): no component imports from db/ or
google/server; no client module imports a server-only module; no domain
import from application/provider/persistence/auth/UI; no route
self-orchestration where a use case exists; no imports from docs/archive;
GP-1 never imports google/client, map components, or the Maps loader; no
raw Google response type into persistence; of Google-returned data, only
approved Place IDs reach canonical writes; scripts never duplicate
domain/application rules.

## Call topology (Decision 16a)

Server Components → application use cases directly. Server Actions =
mutations (thin, validated, authorized). Route Handlers only for viewport
reads, selected-café enrichment, card-photo batch, future external
protocols. No self-HTTP from server code.

## Exemplars (added as their real slices land — never as placeholders)

TODO(step-4): route handler · server-component use-case call · client
island fetch · domain rule · Drizzle query · spatial query · Google server
call · Maps browser adapter · semantic-search intersection · contextual
ID verification · ingestion adapter · flagged use case · operator
authorization check · operator form.
