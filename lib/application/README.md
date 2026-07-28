# `lib/application`

Use cases / orchestration. Returns narrow application DTOs; never raw Drizzle rows or raw provider responses.

Step 3B landed the `promoteAttributeObservation` use case
(`attributes/promote-attribute-observation.ts`): it owns provenance precedence
via the pure `lib/domain` decision core and performs effects through an injected
repository port (implemented once in `lib/db/repositories`). No code outside that
port writes the current-attribute pointer.

Dependency-direction and boundary rules: see `docs/architecture.md` and
`docs/decisions/source/07-application-architecture.md`. Further code lands with
its approved vertical slice (Step 4).
