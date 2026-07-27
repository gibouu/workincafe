# Foundation strip & skeleton — deletion/retention manifest (Step 2B + 3A)

Combined foundation PR (sequencing amendment approved 2026-07-26). The
pre-reconstruction implementation is preserved at the immutable tag
`archive/pre-reconstruction-2026-07-21`. Nothing is deleted outside this
manifest.

## DELETE — legacy application tree

| Path          | Tracked files | Reason                                                               |
| ------------- | ------------- | -------------------------------------------------------------------- |
| `app/`        | 95            | Legacy Next.js app; rebuilt as the approved skeleton                 |
| `components/` | 67            | Legacy UI; rebuilt per Decision 14 on Base UI in feature slices      |
| `lib/`        | 57            | Legacy domain/data/provider code; rebuilt per Decision 13            |
| `tests/`      | 64            | Legacy tests; rebuilt per Decision 22 (Tier 1/2) with slices         |
| `supabase/`   | 50            | Legacy migrations/schema; new baseline in Step 3B (Drizzle)          |
| `ios/`        | 37            | Native app paused (Decision 1/9); state preserved in the tag         |
| `scripts/`    | 14            | Legacy seed/enrich/prune scripts (incl. ToS-violating pipelines, 0a) |
| `design/`     | 4             | Legacy iOS design companion                                          |
| `hooks/`      | 2             | Legacy React hooks; rebuilt in slices                                |
| `types/`      | 1             | Legacy hand-rolled DB types (Decision 6 replaces with generated)     |

## DELETE — legacy root configs (replaced by the new foundation)

`package.json`, `package-lock.json`, `next.config.mjs`, `tsconfig.json`,
`eslint.config.mjs`, `postcss.config.mjs`, `vitest.config.ts`, `proxy.ts`,
`vercel.json`.

## DELETE — legacy CI & agent state

- `.github/workflows/ci.yml`, `.github/workflows/codeql.yml` — custom GitHub
  Actions workflows; none at launch (Decision 19-GH). CodeQL, if wanted, is
  re-enabled via GitHub's settings-based default setup (no workflow file).
- `.claude/launch.json`, `.claude/state/*` — legacy agent tooling/memory;
  preserved in the tag (Step-1 manifest disposition: delete at Step 3A).

## RETAIN

| Path                                                                                  | Note                                                     |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `docs/`                                                                               | Governance + decision records + archive (Steps 1–2A)     |
| `.github/CODEOWNERS`, `ISSUE_TEMPLATE/`, `PULL_REQUEST_TEMPLATE.md`, `dependabot.yml` | Step 2A governance; dependabot is config, not a workflow |
| `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`                                           | Governance                                               |
| `tools/governance-check.sh`                                                           | Step 2A neutral check (+ new dep check added here)       |
| `LICENSE`                                                                             | Unchanged                                                |
| `.gitignore`                                                                          | Retained (already covers node_modules/.next/env/vercel)  |

## REPLACE / REWRITE

- `README.md` — rewritten to the reconstruction/foundation state.
- `SECURITY.md` — trimmed of stale legacy specifics (scope pointer only).

## ADD — see the PR for the full new tree, configs, and skeleton.
