# Security

Dependency vulnerability handling is governed by **Decision 26**
(`docs/decisions/source/13-dependency-security-policy.md`).

- `advisory-dispositions.json` — the machine-readable register: every current
  `npm audit` advisory, listed individually, with its path, installed version,
  severity, scope, reachability analysis, mitigation, disposition, approving
  decision, and recheck triggers. No blanket/wildcard acceptance.
- `tools/check-security-advisories.mjs` — reconciles live `npm audit --json`
  against the register, prints the raw audit totals verbatim (never concealed),
  and fails on a new/unreviewed advisory, a changed severity/range, a
  hard-blocker disposition, or an unapplied compatible standard fix. It runs in
  `npm run verify`.

The gate is disposition-based, not "npm audit = 0". Standard-only dependency
resolution remains mandatory (no overrides, resolutions, aliases, forks,
`patch-package`, canary/beta/RC, `--force`, downgrades to alter output, or
advisory suppression). When a compatible standard stable fix appears, it is
applied promptly; the project does not halt unrelated work while a path is
explicitly mitigated.
