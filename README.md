# WorkinCafe

A Toronto café finder for students and remote workers — discover cafés suitable for
studying or working, filtered by the conditions that matter (Wi-Fi, noise, power outlets,
seating).

> **Status: under reconstruction.** This repository is being rebuilt on a governed,
> requirement-first foundation. The previous implementation is preserved at the immutable
> tag `archive/pre-reconstruction-2026-07-21`. See [`docs/RECONSTRUCTION.md`](docs/RECONSTRUCTION.md).

## Foundation stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · ESLint (flat config) ·
Prettier · Vitest. Data, auth, maps, and UI libraries are introduced with their approved
feature slices (see the dependency allowlist and decision records). Exact versions are
pinned in `package.json` and locked in `package-lock.json`.

- Runtime: **Node 24.x** (`.nvmrc`). Use `nvm use` or install Node 24 before working.
- Package manager: **npm** (`npm ci` for reproducible installs).

## Commands

| Command                | What it does                                    |
| ---------------------- | ----------------------------------------------- |
| `npm run dev`          | Dev server                                      |
| `npm run build`        | Production build                                |
| `npm run start`        | Serve the production build                      |
| `npm run format`       | Prettier (write)                                |
| `npm run format:check` | Prettier (check)                                |
| `npm run lint`         | ESLint (`eslint .`; `next lint` is not used)    |
| `npm run typecheck`    | `tsc --noEmit`                                  |
| `npm run test`         | Vitest (Tier 1)                                 |
| `npm run policy:check` | Governance + dependency-allowlist checks        |
| `npm run verify`       | format:check → lint → typecheck → policy → test |

Deployment is Vercel's Git integration; the Vercel build runs `npm run verify` then
`next build`. There are no custom GitHub Actions workflows.

## Where to look first

- [`AGENTS.md`](AGENTS.md) — operational rules for contributors and coding agents.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — authority, plan-before-change, dependency and scope rules.
- [`docs/product-scope.md`](docs/product-scope.md) — what is and isn't in scope.
- [`docs/architecture.md`](docs/architecture.md) — module structure and dependency directions.
- [`docs/decisions/`](docs/decisions/) — the ratified decision records (authoritative).

## License

[MIT](LICENSE).
