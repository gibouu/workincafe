# Operative decision record — Decision 1: Repository and revision strategy

Approved 2026-07-22 (amended through 24b, 2026-07-24).

## Ruling

Strategy C — requirement-first clean foundation — reconstructed **in
place** in the existing repository. Principle: **one repository, one
canonical `main`, one active architecture, one immutable legacy
snapshot.**

## Bindings

- Immutable annotated tag `archive/pre-reconstruction-2026-07-21`
  (commit `cf66a5c`), protected by an `archive/*` tag ruleset (no
  deletion, no re-pointing). **No legacy branch** is created or maintained
  absent a recorded future need. Git history and the protected tag are the
  sole legacy-code reference.
- Long-term application downtime is fully acceptable; `main` must remain
  intentional, understandable, and pass the CI checks applicable to its
  current reconstruction phase. After the strip, `main` holds the smallest
  valid Next.js shell needed to keep the repository buildable and
  structurally coherent. "Long application downtime is acceptable;
  accidental repository disorder is not."
- Step sequence: 0 (snapshot/freeze/owner verifications) → 1 (governance)
  → 2A (technology-neutral enforcement: plan-before-change, dependency and
  product-scope approval rules, archive protection, verification
  expectations, no silent technology adoption) → 2B (approved skeleton +
  technology-specific enforcement) → 3A (legacy strip) → 3B (database
  baseline; migration chain freezes) → 4 (vertical slices).
- Legacy feature PRs are closed with pointer notes; monitoring/dependency
  tooling (Dependabot-class) stays enabled with phase-aware triage against
  the dependency register.
- Terminology: preserve / port / reimplement / remove / archive are the
  dispositions; "migrate" is reserved for true data/identity/provider
  transitions. No compatibility layers merely because a production
  migration would normally expect them. No additive-only API guarantee for
  the dormant legacy iOS client.
- The pre-reconstruction database archive is a one-time reconstruction and
  compliance artifact (sanitized per 0a; procedure in the Step 0 owner
  checklist); it does not reinstate ongoing backup automation.

## Instruction-file architecture (approved)

`AGENTS.md` is tool-neutral and authoritative; `CLAUDE.md` is the Claude
Code entry point importing `@AGENTS.md` — the import behavior is verified
in-repository before being relied on as enforcement. Precedence order per
`docs/decisions/README.md`. Archived documents and agent memory are never
authoritative. Governance documents must not imply repository ownership or
enforceable review requirements that do not actually exist.

## Related

1c (repository governance / organization transfer): closed by 24c-G6 —
see source/11.
