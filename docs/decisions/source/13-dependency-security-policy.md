# Operative decision record — Decision 26: dependency advisory and vulnerability gate

Ratified 2026-07-28. Establishes how dependency vulnerability advisories are
gated. Supersedes the interim "npm audit must report zero" completion criterion
used during the Step 3B strict-gate review. Change-controlled like every
operative record.

## 26a — The gate is disposition-based, not count-based

A non-zero raw `npm audit` count does **not** by itself block the reconstruction.
Both raw audit commands are still run and their **complete output is always
displayed and never hidden**, as evidence. The security completion gate is:

> Zero unresolved, unreviewed or inadequately mitigated security advisories.

Concretely, completion requires:

```text
Unreviewed advisories: 0
Unmitigated reachable advisories: 0
Available compatible fixes left unapplied: 0
Unknown-reachability high/critical advisories: 0
```

This is not permission to ignore advisories or carry soft blockers forward.
Every advisory receives a complete, evidence-backed disposition in the current
step, recorded individually (no blanket wildcard acceptance).

## 26b — Standard dependency resolution remains mandatory

Retained in full (Decisions 2, 6, 24d and the Step 3B strict-gate rulings).
Prohibited: npm `overrides`, resolutions, aliases, forks, `patch-package`,
canary/beta/RC/preview packages, forced installs, direct transitive replacement
packages, `npm audit fix --force`, downgrades solely to alter audit output, and
advisory suppression that hides findings. Only latest approved **stable direct**
dependencies through their normal package graphs are used. A compatible standard
stable fix, when one exists, is applied promptly (see triggers); the project does
not halt unrelated work while a path is explicitly mitigated.

## 26c — Dispositions (exactly one per advisory)

1. **Remediated** — the vulnerable version was removed by a normal compatible
   direct-package update.
2. **Not reachable under enforced architecture** — the vulnerable function or
   exposure condition cannot occur in WorkinCafe, protected by configuration,
   architecture boundaries, tests, or static checks.
3. **Accepted residual risk** — the path is technically present but exploitation
   conditions are absent or strongly constrained; the technical lead explicitly
   accepts the remaining risk after reviewing severity, affected function,
   required attacker input, prod-vs-dev scope, data/privileges at risk, current
   mitigations, and the consequence if assumptions change. A **closed decision**,
   not a soft blocker.
4. **Hard blocker** — the affected code is reachable (or reachability is
   uncertain), impact is material, and no adequate current mitigation exists.
   Only hard blockers stop the step.

## 26d — Blocking criteria

An advisory blocks the current step when **any** hold: critical in a deployed
dependency and not conclusively unreachable; high and reachable from untrusted
input; reachability indeterminate; a compatible standard stable fix exists but is
unapplied; the affected code handles authentication, authorization, secrets,
database access, or user-controlled input without adequate mitigation; a
previously accepted assumption is no longer true; required mitigating
configuration/tests are absent; or the advisory is new and unreviewed.

An advisory does **not** block merely because npm labels it high, it appears
transitively, it is in an optional or development-only package, or npm's
suggested automatic fix is a breaking downgrade. Those facts inform, but do not
replace, reachability analysis.

## 26e — Register and automated policy check

- **Register:** `docs/security/advisory-dispositions.json` lists every advisory
  individually with GHSA id, package, path, installed affected version,
  severity, scope, affected function, WorkinCafe reachability, mitigation,
  disposition, approving decision, recheck triggers, and review date.
- **Check:** `tools/check-security-advisories.mjs` (dependency-free) runs/consumes
  `npm audit --json`, reconciles it with the register, prints the raw totals
  verbatim, and **fails** when a new advisory appears, an advisory lacks a
  disposition, severity/patched-range/path changes materially, an accepted
  mitigation is no longer verifiable, or a compatible standard fix is available
  but unreviewed. It never alters or conceals npm's output. It runs in `verify`.

The security check passes because findings are reviewed and controlled, not
because they are hidden.

## 26f — Review triggers

Re-review an accepted advisory when: an affected direct dependency changes; a
stable upstream fix becomes available; the advisory's severity/description/patched
range changes; a new/active exploit is reported; a mitigation test fails; the
application begins accepting the affected untrusted input; the package moves from
development-only into the deployed bundle; before public launch; and during every
dependency-update PR affecting the path.

## 26g — Standing mitigations these dispositions rely on

- **No untrusted CSS** reaches the PostCSS build pipeline: only reviewed,
  repository-controlled CSS and approved packages; no user/CMS/operator-authored
  or uploaded CSS, no runtime CSS-processing endpoint, no remote stylesheet piped
  through the build.
- **Image optimization is disabled globally** (`next.config.mjs` →
  `images.unoptimized: true`); no image upload, server-side transformation, or
  image-proxy endpoint; no untrusted image bytes; Google photos stay direct,
  live, and unoptimized (existing compliance decision); no first-party import of
  `sharp`.
- **Dev tooling is never network-exposed or fed untrusted input:** no
  `drizzle-kit studio`/esbuild dev-server/`esbuild serve`; the Better Auth `auth`
  CLI is a dev dependency only, runs against repository-controlled configuration,
  and is not shipped in the production bundle; ESLint processes only fixed
  repository-controlled patterns. None of drizzle-kit, `auth`, or ESLint is part
  of the deployed runtime.

Adopting ESLint 10, replacing Drizzle Kit, or replacing the Better Auth CLI
requires a new reviewed decision.
