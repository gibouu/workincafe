# Operative decision record — Decision 8: authentication and authorization

Approved 2026-07-23.

## Ruling

**Self-hosted Better Auth** in the Next.js application: latest stable
non-preview release at implementation; Better Auth's Drizzle adapter; our
Neon PostgreSQL; the pooled application connection for normal auth
traffic; auth tables created through reviewed Drizzle-generated SQL
migrations in the ordinary chain.

## Bindings

- Authentication exists only for: the deployed curation interface, the
  separate mapless GP-1 administration surface, and explicitly approved
  operator-only functionality. The public experience is fully anonymous —
  no session, account, or identity-related request for ordinary browsing.
- **Authentication ≠ authority.** Every protected server-side action
  verifies (1) a valid Better Auth session AND (2) explicit WorkinCafe
  operator authorization against WorkinCafe-controlled operator records.
  Never sufficient alone: hidden URLs, client-side route protection,
  session existence, email-domain rules, UI visibility, middleware without
  server-side mutation checks. Controlled operator accounts (the expected
  group is currently small; no exact count is encoded).
- **Registration:** public self-registration is disabled at launch, using
  the provider's supported sign-up controls plus, where needed, a
  fail-closed server-side allowlist or creation hook — never merely hidden
  sign-up UI over active endpoints. Operator enrollment is controlled and
  documented; no new identity becomes an operator without an explicit
  reviewed action. Community registration reopens only through a separate
  reviewed product, privacy, moderation, abuse-prevention, and security
  decision.
- **Identity/schema boundary:** application records reference a stable
  internal authenticated-user identifier; feature code never depends on
  OAuth-provider identifiers; authorization data stays in
  WorkinCafe-controlled tables/configuration; Better Auth tables are not
  casually modified outside the documented integration; generated auth
  schema changes are reviewed like all migrations. **A database dump alone
  is not a complete authentication backup** — OAuth client configuration,
  secrets, trusted origins/callback URLs, and cookie/session configuration
  must be documented for reconstruction.
- **Feature posture:** stable Better Auth capabilities only; no
  unnecessary plugins initially (organizations, teams, passkeys, 2FA, SSO,
  user-administration suites); smallest method sufficient for the current
  operators; additional providers/plugins require demonstrated need plus a
  reviewed dependency/configuration change.
- **Required tests** (obligations matrix): anonymous browsing without
  auth; unauthenticated and authenticated-non-operator requests blocked
  from operator actions; approved operators succeed; server-side
  enforcement; unapproved-identity registration rejected; expired/revoked/
  malformed/missing sessions fail closed; no secrets in public bundles;
  GP-1 remains separate and mapless; auth tables build from empty via the
  committed chain; auth-dependent tests run against the approved local
  PostgreSQL environment.

## 8e — Neon Managed Better Auth: not adopted

Failed FW-1 and the launch registration policy at ruling time (officially
Beta product and beta-only SDK; restricted registration unsupported —
"anyone can sign up by default"; insufficient documentation for local
PostgreSQL development, backup/export behavior, and migration to/from
self-hosted Better Auth). Recorded as re-evaluable, **not** an intended
migration destination. Re-evaluation conditions: general availability; a
stable non-beta SDK channel; supported restricted registration; documented
backup/export behavior; documented local-development and test strategy; a
credible migration or interoperability story. Even then, migration
requires a demonstrated concrete advantage over the functioning
self-hosted system and explicit approval.
