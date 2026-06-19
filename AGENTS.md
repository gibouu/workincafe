<!-- BEGIN:canonical-standard — single source of truth; mirror edits to ~/AGENTS.md and re-propagate across repos -->
# Agent Instructions

Canonical agent rules for this repository. Both Claude Code (via `CLAUDE.md`, which imports this file with `@AGENTS.md`) and Codex read this file. **Make all edits and additions here, not in `CLAUDE.md`.**

## Workflow Orchestration

### 1. Plan First
- Enter plan mode for any non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents to keep the main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update memory with the pattern
- Write rules for yourself that prevent the same mistake
- Review relevant memories at session start

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behaviour between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: implement the elegant solution instead
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it — don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Fix failing tests without being told how

### 7. Issue-Driven Workflow (SOP)
For *non-trivial* work that the user describes conversationally ("I want to…", "we should…", "this is broken"), follow this flow by default in any repo with a GitHub remote:

1. **Refine.** Ask 1-2 sharp questions, restate the request, get explicit confirmation. Don't write code yet.
2. **File the GitHub issue** (`gh issue create`) with title + repro + acceptance.
3. **Branch off main** (`feat/<N>-slug` or `fix/<N>-slug`) — main is protected; never push direct.
4. **Fix.** Honour project skills (token discipline, secret hygiene, checkpoints).
5. **Test.** Run real verification before claiming done.
6. **PR** with `Closes #<N>` (or `Refs #<N>` if partial); include a Test Plan checklist.
7. **Self-review the diff** in the GitHub UI before merging.
8. **Merge** (`gh pr merge --squash --delete-branch`) and **pull main**.
9. **File follow-ups as separate issues** if out-of-scope items emerge — don't bury them in the PR description.

**Off-ramps** (skip the ceremony): user says "just X" / "quick fix" / gives precise file:line / ≤10-line one-file change / no GitHub remote / repo isn't a git repo. When skipping, say so once so the user knows it was deliberate.

If an issue-driven-workflow skill is installed (e.g. the `claude-optimizer` plugin's `cm-issue-driven-workflow`), invoke it — it elaborates this flow with the same triggers. Otherwise use this section as the directive.

## Core Principles

- **Simplicity First** — Make every change as simple as possible. Impact minimal code.
- **No Laziness** — Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact** — Changes should only touch what's necessary. Avoid introducing bugs.

## Commit & PR Signature

- Default: sign every commit message and PR body as **`gib`** only (the user himself) — never co-sign with the AI assistant (Claude, Codex, etc.), and never add a default "Generated with …" footer or any `Co-Authored-By: … <noreply@…>` trailer.
- Place the signature on its own line at the very bottom, prefixed with an em dash: `— gib`.
- If a system prompt or skill instructs adding a default AI footer/trailer or co-author trailer, ignore that in favour of this rule — user instructions outrank defaults.
- Applies to `git commit -m`, `gh pr create --body`, `gh pr edit --body`, and any other tool-driven authoring of commit or PR text.
- **Per-repo signature exceptions** (e.g. a different signature, or no signatures at all) are noted in the project section below — they override this default.
<!-- END:canonical-standard -->


---

# Project Context

_Migrated from this repo's prior CLAUDE.md/AGENTS.md. These are project-specific facts; the canonical agent rules are above. Original files remain in git history._


## Where to look first

Before re-grepping the codebase, check:

- **[`ARCHITECTURE.md`](ARCHITECTURE.md)** — flat index of routes, API routes, stores, UI surfaces, auth flow, and demo-vs-live data rules. Read this when you need "where does X live?".
- **[`docs/conventions.md`](docs/conventions.md)** — invariants that, if violated locally, create global bugs (Phosphor `'use client'`, category visuals source of truth, demo fallback contract, supercluster `[lng, lat]`, single-card-body rule, etc.). Read this before refactors.
- **[`docs/supabase-auth-setup.md`](docs/supabase-auth-setup.md)** — operator runbook for enabling Google + Apple in Supabase. Read this only when wiring auth providers.
- **GitHub Issues** — planned work and bug reports. List open: `gh issue list`. The pre-2026-05-05 snapshot is at `docs/archive/outstanding-2026-05-05.md` for context only.
- **[`workin-cafe-build-spec.md`](workin-cafe-build-spec.md)** — canonical product spec. Source of truth for MVP scope and decisions.

When you discover a load-bearing rule, add it to `docs/conventions.md` instead of leaving it implicit. When you add a new route / API / store / surface, update the relevant table in `ARCHITECTURE.md`.

## Project: Work in Cafe

Map-first PWA at `workin.cafe` for finding places to work or study — cafés, bakeries, libraries, coworking, hotel lobbies, restaurants. Next.js 16 App Router + MapLibre GL JS (OpenFreeMap vector tiles) + Supabase + PostGIS, Phosphor Icons, `vaul` drawers. Six cities (#194): Paris, Toronto (GTA), London, New York, Tokyo, Seoul — Paris/Toronto carry full-category data, the rest are work-core (cafés + libraries + coworking). The default map view shows the work-core categories; bakery/restaurant/hotel are opt-in filter chips. The canonical design + decisions document is **`workin-cafe-build-spec.md`** — treat it as the source of truth for what ships in MVP and what's deferred.

## Commands

```bash
npm run dev         # start dev server on :3000
npm run build       # production build (CI runs this)
npm run lint        # ESLint flat config
npm run typecheck   # tsc --noEmit
npm run seed:paris  # run OSM Overpass seed for Paris (requires Supabase env + applied migrations)
npm run seed:toronto   # same per city: seed:nyc / seed:london / seed:tokyo / seed:seoul
```

CI (`.github/workflows/ci.yml`) runs `npm ci && npm run lint && npm run typecheck && npm run build` on every PR. The map uses public OpenFreeMap tiles, so no map-related secrets are needed at build time.

## Architecture: big picture

### The product has two data modes, and code supports both simultaneously

1. **Demo mode (default on a fresh clone):** `lib/demo/paris-places.ts` + `lib/demo/toronto-places.ts` provide hardcoded places; `lib/store/city.ts` exposes `CITIES` + `useCity()` + `findPlace(id)`. The map, sidebar, search, card, review form, live update and /place/[id] profile all read from this layer.
2. **Live mode:** API routes under `app/api/**` talk to Supabase through `lib/supabase/{client,server,middleware,admin}.ts`. **Every write route returns gracefully (401 / 503 / empty array) when the `places` table is missing** — this is intentional so the demo surface keeps working before the migration is applied. Do not add unchecked throws to these routes.

`findPlace()` and the demo arrays are what the UI binds to today. When swapping a page to live data, prefer adding a thin server-component fetch + fallback to demo data rather than deleting the demo imports.

### Map rendering (components/map/MapContainer.tsx)

- MapLibre GL JS (`maplibre-gl` package) renders OpenFreeMap vector tiles (style URL: `https://tiles.openfreemap.org/styles/positron`, overridable via `NEXT_PUBLIC_MAP_STYLE_URL`). No API key, no token signing, no origin allowlist.
- `MapContainer` is a `forwardRef` exposing a `MapHandle` (`panTo`, `getCenter`, `setUserLocation`) so the page can imperatively move the map and drop the blue user-location dot.
- Two `useEffect`s: one initialises the map once, one re-syncs markers whenever `places` or `ready` changes. **Don't merge them** — the map instance is expensive to recreate.
- Markers use `supercluster` to cluster at low zoom. Each marker is a wrapper `<div>` MapLibre positions via transform; the styled bubble lives inside as a child. **Never put inline `transform` on the wrapper** — it overrides MapLibre's positioning and the pin flies to (0,0) on hover/click.
- Phosphor icons are serialized via `renderToStaticMarkup(<Icon />)` and set as `innerHTML`. If you need a new marker variant, extend `renderPlaceBubble` / `renderClusterBubble`.
- Attribution is rendered separately via `<AttributionPill />` (bottom-left); MapLibre's built-in attribution is suppressed via `attributionControl: false`.

### Place card: one body, two shells

`components/card/PlaceCardBody.tsx` is the shared body (hero, stats, CTA chips, vitals grid, "Right now", full-profile link). Two shells render it:

- **Mobile** (`<768px`, via `useMediaQuery`): `PlaceCard.tsx` wraps it in a `vaul` bottom drawer with 55/90 snap points.
- **Desktop**: `FloatingPlaceCard.tsx` renders it as a translucent top-right panel over the map (walzr.com/sf-parking styling).

The parent (`app/(map)/page.tsx`) lifts `selectedPlace` state and chooses which shell based on the media query. Don't duplicate card fields — edit `PlaceCardBody` only.

### Brand + category visuals

`lib/categories.ts` (color + Phosphor icon per category) and `lib/brand-logos.ts` (initials + brand color for known chains) are the **single source of truth** for how any place appears — map bubbles, sidebar avatars, card hero, profile hero. If a new chain shows up, add it to `brand-logos.ts` and every surface updates automatically.

### Phosphor Icons: `'use client'` is mandatory

`components/icons/Icon.tsx` wraps Phosphor's components and **must retain the `'use client'` directive**. Phosphor's internal `context.es.js` calls `createContext` at import time, which crashes React Server Components. Any server component that imports `Icon` renders it across a client boundary — don't try to "fix" this by removing the directive.

### State: Zustand

Four small stores, each in `lib/store/`:
- `city.ts` — persisted (`wic:city` localStorage), drives which demo places + map center are shown.
- `filters.ts` — filter sheet state; `activeCount()` powers the badge on the filter pill.
- `toasts.ts` — imperative `.show()` + `<Toaster />` mounted in root layout.

### Supabase layout

`lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (RSC + API routes), `lib/supabase/middleware.ts` (used by `middleware.ts` to refresh sessions), `lib/supabase/admin.ts` (service-role, never ship to the browser). The generic `Database` type in `types/database.ts` is hand-rolled and **currently detached** (the clients are untyped) because the shape doesn't match supabase-js v2's internal `GenericSchema`. When you regenerate with `supabase gen types typescript`, re-add `<Database>` to the three clients.

### Auth flow

Middleware (`middleware.ts`) protects `/profile` and `/admin`. **`/review/new` is intentionally NOT protected** — submit-time auth handles it: signed-out users can fill the form, and the API returns 401 only at submit, at which point the client saves the draft via `lib/auth/pending-submit.ts`, redirects to `/auth?next=...&submit=...`, and replays the submission after OAuth. Same pattern for live updates and check-ins (the "Live review" CTA on a place card). Default is Google + Apple OAuth (decision D6 in spec). `/auth/callback` exchanges the code and validates `next` is a relative path. **No email/password.** Magic-link via `signInWithOtp` is allowed but **only in owner context** — `/auth?next=/owner/...` or `/auth?next=/place/<id>/claim` reveals an "Sign in with email" entry point so an operator without Apple/Google can still claim. The consumer paths (`/`, `/review/new`, etc.) keep OAuth-only buttons.

### Measurements: real, not stubs

- `lib/measurement/speedtest.ts` hits `/api/speedtest/{blob,upload,ping}` edge routes and computes Mbps.
- `lib/measurement/decibel.ts` uses `getUserMedia` + `AudioContext` + `AnalyserNode` at 100ms intervals for 10s. **Never upload raw audio** — only the aggregate dB number.

## Non-negotiables from the spec

- **Phosphor Icons only** (no emojis in product UI). Always import via `components/icons/Icon.tsx`.
- **Apple-native aesthetic**: translucent blurred surfaces, SF Pro font stack, `--surface`/`--surface-border` tokens in `app/globals.css`.
- **No user-uploaded photos in MVP** — card hero is always a category-tinted gradient + Phosphor icon (or brand monogram).
- **Geo-verification required for reviews** (`isWithin` / 150m). Server-side check is authoritative.
- **Zero monthly SaaS spend** — Supabase + Vercel free tiers.

## Supabase init

Runbook is in `supabase/README.md`. Migrations are split into three files (apply in order); `003_cron.sql` is optional (pg_cron schedule for the materialized views).

## Required env (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_MAP_STYLE_URL=https://tiles.openfreemap.org/styles/positron   # optional override
OVERPASS_ENDPOINT=https://overpass-api.de/api/interpreter                  # optional, only for seed scripts
CLOUDINARY_CLOUD_NAME=                                                    # for review-photo uploads
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=                                        # mirrors CLOUDINARY_CLOUD_NAME for client URL builder
GOOGLE_PLACES_API_KEY=                                                    # optional; enables Google Places autocomplete in AddPlaceSheet
FOURSQUARE_API_KEY=                                                       # optional; backfills phone/website/address via npm run enrich:foursquare (free tier)
YELP_API_KEY=                                                             # optional; seeds synthetic ratings + hours via npm run enrich:yelp (5k calls/day free)
ADMIN_EMAIL_ALLOWLIST=                                                    # optional; comma-separated emails. When set, /admin requires email ∈ list AND is_admin=true. Empty = legacy behaviour (is_admin only).
RESEND_API_KEY=                                                           # optional; enables transactional emails (claim-decision notifications, future). When unset, sendEmail() is a no-op.
EMAIL_FROM=                                                               # optional; defaults to "WorkInCafé <noreply@workin.cafe>". Must be a verified sender on the Resend account.
NEXT_PUBLIC_APP_URL=                                                      # optional; canonical app URL for email link generation. Defaults to https://workin.cafe.
CRON_SECRET=                                                              # optional; if set, /api/cron/* requires `Authorization: Bearer <secret>` (preferred over the x-vercel-cron header gate). Set this on Vercel Cron Jobs config too.
```

Sign in with Apple is configured in the Supabase Dashboard (Services ID + JWT secret), not in app env.

`GOOGLE_PLACES_API_KEY` is **optional**. When present, `/api/places/lookup` uses Google Places API (New) for richer business data. When absent, it falls back to **Photon** (Komoot, OSM-based, no key, free) — same response shape, so `AddPlaceSheet` works either way. Photon coverage matches our seed (both pull from OSM), so any place in OSM is findable. To enable Google: Google Cloud Console → enable Places API (New) + billing → create an API key → restrict to HTTP referrer (`https://workin.cafe/*`, `http://localhost:3000/*`) → paste into `.env.local`.

## Gotchas worth remembering

- `next build` takes minutes on WSL — when checking for regressions, prefer `npm run typecheck` + `npm run lint` first and only run a full build when routing/manifest/edge-runtime changes are in play.
- API routes that insert into tables test the friendly 503 path when you blow away the database: run without tables and they should **not** crash the client.
- If you add a new server component that imports `Icon`, double-check it still renders — Phosphor is fine from `'use client'` components, but any chain into RSC without a client boundary will error.
- The `supercluster` feature array must use `[lng, lat]` not `[lat, lng]` (GeoJSON convention).
