# Work in Café

Map-first PWA at **[workin.cafe](https://workin.cafe)** for finding places to work or study — cafés, bakeries, libraries, coworking, hotel lobbies, restaurants. Six cities: **Paris**, **Toronto (GTA)**, **London**, **New York**, **Tokyo**, **Seoul**.

Built with Next.js 16 (App Router) + MapLibre GL JS (OpenFreeMap vector tiles) + Supabase + PostGIS, Phosphor Icons, and `vaul` drawers. Apple-native aesthetic: translucent surfaces, SF Pro stack, no user-uploaded photos in MVP.

## Quickstart

```bash
npm install
npm run dev                         # http://localhost:3000
```

A `.env.local` is **optional** for local exploration — see [`CLAUDE.md`](CLAUDE.md) for the full env-var list (Supabase, Cloudinary, Google Places, etc.). Without it the app runs in demo mode.

Before contributing, read [`MEMORY.md`](MEMORY.md) for the current handoff state, active branches, verification boundaries, blockers, and recommended continuation order; then read [`AGENTS.md`](AGENTS.md).

The repo ships with **demo mode** baked in (`lib/demo/paris-places.ts`, `lib/demo/toronto-places.ts`), so the map, sidebar, search, card, review form, and place profile all work on a fresh clone without a Supabase project. To go live, apply the migrations under `supabase/migrations/` (see `supabase/README.md`) and the API routes start writing through.

## Scripts

| Command            | What it does                                 |
| ------------------ | -------------------------------------------- |
| `npm run dev`      | Dev server on `:3000`                        |
| `npm run build`    | Production build                             |
| `npm run lint`     | ESLint (Next.js flat config)                 |
| `npm run typecheck`| `tsc --noEmit`                               |
| `npm run seed:paris` | OSM Overpass seed for Paris                |

CI runs `npm ci && npm run lint && npm run typecheck && npm test && npm run build` on every PR.

## Where the docs live

- **[`workin-cafe-build-spec.md`](workin-cafe-build-spec.md)** — canonical product spec, MVP scope, design decisions.
- **[`ARCHITECTURE.md`](ARCHITECTURE.md)** — flat index of routes, API routes, stores, UI surfaces, auth flow, demo-vs-live data rules.
- **[`docs/conventions.md`](docs/conventions.md)** — invariants that, if violated locally, create global bugs (Phosphor `'use client'`, category visuals source of truth, `[lng, lat]` for supercluster, etc.).
- **[`supabase/README.md`](supabase/README.md)** — migration runbook + Supabase setup.
- **[`CLAUDE.md`](CLAUDE.md)** — instructions for AI coding agents working in this repo.
- **[`MEMORY.md`](MEMORY.md)** — durable project state, completed milestones, blockers, issue mapping, and continuation order.

## Contributing

PRs are welcome — open an issue first for non-trivial changes so we can align on scope.

1. Fork → branch (`feat/<slug>` or `fix/<slug>`).
2. `npm run lint && npm run typecheck && npm test && npm run build` should all pass.
3. Open a PR against `main`. Vercel may build a preview; CI will run `verify`.
4. Preview access and environment scope are controlled by the Vercel project. See [issue #57](https://github.com/gibouu/workincafe/issues/57) before relying on a preview URL.

## License

[MIT](LICENSE).
