# `lib/application`

Use cases / orchestration. Returns narrow application DTOs; never raw Drizzle rows or raw provider responses.

Dependency-direction and boundary rules: see `docs/architecture.md` and
`docs/decisions/source/07-application-architecture.md`. No feature code lands
here until its approved vertical slice (Step 4).
