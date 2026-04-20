# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Work in Cafe

Map-first PWA at `workin.cafe` for finding places to work or study — cafés, bakeries, libraries, coworking, hotel lobbies, restaurants. Next.js 15 App Router + Apple MapKit JS + Supabase + PostGIS, Phosphor Icons, `vaul` drawers. Two launch cities: Paris + Toronto. The canonical design + decisions document is **`workin-cafe-build-spec.md`** — treat it as the source of truth for what ships in MVP and what's deferred.

## Commands

```bash
npm run dev         # start dev server on :3000
npm run build       # production build (CI runs this)
npm run lint        # next lint (ESLint flat via eslint-config-next)
npm run typecheck   # tsc --noEmit
npm run seed:paris  # run OSM Overpass seed for Paris (requires Supabase env + applied migrations)
npx tsx scripts/seed-osm.ts toronto   # Toronto seed (no npm alias yet)
```

CI (`.github/workflows/ci.yml`) runs `npm ci && npm run lint && npm run typecheck && npm run build` on every PR with *blank* Apple MapKit keys — build must not throw on missing runtime env; runtime code checks env per request.

## Architecture: big picture

### The product has two data modes, and code supports both simultaneously

1. **Demo mode (default on a fresh clone):** `lib/demo/paris-places.ts` + `lib/demo/toronto-places.ts` provide hardcoded places; `lib/store/city.ts` exposes `CITIES` + `useCity()` + `findPlace(id)`. The map, sidebar, search, card, review form, live update and /place/[id] profile all read from this layer.
2. **Live mode:** API routes under `app/api/**` talk to Supabase through `lib/supabase/{client,server,middleware,admin}.ts`. **Every write route returns gracefully (401 / 503 / empty array) when the `places` table is missing** — this is intentional so the demo surface keeps working before the migration is applied. Do not add unchecked throws to these routes.

`findPlace()` and the demo arrays are what the UI binds to today. When swapping a page to live data, prefer adding a thin server-component fetch + fallback to demo data rather than deleting the demo imports.

### Map rendering (components/map/MapContainer.tsx)

- `loadMapKit()` in `lib/mapkit/client.ts` lazily injects Apple's CDN script and hands back a hand-rolled subset of the MapKit JS type surface (typings are deliberately narrow — add only what you need).
- `MapContainer` is a `forwardRef` exposing a `MapHandle` (`panTo`, `getCenter`) so the page can imperatively move the map (used by search, city switch, geolocate, add-a-place).
- Two `useEffect`s: one initialises the map once, one re-syncs annotations whenever `places` or `ready` changes. **Don't merge them** — the map instance is expensive to recreate.
- Annotations use `supercluster` to cluster at low zoom. The factory callback must return an `HTMLElement`, so Phosphor icons are serialized via `renderToStaticMarkup(<Icon />)` and set as `innerHTML`. If you need a new marker variant, extend `renderPlaceBubble` / `renderClusterBubble`.
- Native MapKit POIs are restricted via `map.pointsOfInterestFilter` to `Cafe`, `Bakery`, `Library`, `Hotel`, `Restaurant`, `FoodMarket`. Coworking + fast-food come from custom annotations only.

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

Middleware (`middleware.ts`) protects `/profile`, `/review/new`, `/admin`. Only Google + Apple OAuth (decision D6 in spec). `/auth/callback` exchanges the code. **No email/password, no magic link** — don't add them.

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
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_MAPKIT_PRIVATE_KEY=   # .p8 contents, real newlines or \n-escaped on one line
NEXT_PUBLIC_APPLE_MAPKIT_ORIGIN=https://workin.cafe
OVERPASS_ENDPOINT=https://overpass-api.de/api/interpreter   # optional
```

## Gotchas worth remembering

- `next build` takes minutes on WSL — when checking for regressions, prefer `npm run typecheck` + `npm run lint` first and only run a full build when routing/manifest/edge-runtime changes are in play.
- API routes that insert into tables test the friendly 503 path when you blow away the database: run without tables and they should **not** crash the client.
- If you add a new server component that imports `Icon`, double-check it still renders — Phosphor is fine from `'use client'` components, but any chain into RSC without a client boundary will error.
- The `supercluster` feature array must use `[lng, lat]` not `[lat, lng]` (GeoJSON convention).
