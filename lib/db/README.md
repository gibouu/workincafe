# `lib/db`

Drizzle schema, queries, repositories, migration client. Server-only by
convention and by ESLint boundary (components/app cannot import `@/lib/db/*`);
these modules import `pg`/`drizzle-orm` and are loaded only by server code,
tooling, and tests. The `server-only` marker is intentionally **not** imported
here because drizzle-kit and Vitest load these files in plain Node, where that
package throws.

Step 3B landed the canonical schema (`schema/*.ts`, with the DB-enforced CHECK
matrix derived from `lib/domain` via `schema/_sql.ts`), the generated Better Auth
schema (`schema/auth.generated.ts`), the client factory (`client.ts`), the
attribute-promotion repository (`repositories/`), and the Tier 2 local-only
guard (`testing/local-guard.ts`).

Dependency-direction and boundary rules: see `docs/architecture.md` and
`docs/decisions/source/07-application-architecture.md`. Query/spatial-read
modules land with their approved vertical slice (Step 4).
