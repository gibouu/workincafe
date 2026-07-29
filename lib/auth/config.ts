import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
// Relative import (not `@/`): the Better Auth CLI resolves this config outside
// the Next.js/tsconfig path alias context (`npm run auth:schema:generate`).
import { account, session, user, verification } from '../db/schema/auth.generated'

// Better Auth configuration for the operator surface (Decision 8): email +
// password only, public sign-up disabled, no plugins (no organizations, teams,
// passkeys, 2FA, SSO, admin). Authorization is separate — an active `operators`
// row (lib/db/schema/operators.ts) gates operator capability, enforced
// server-side.
//
// NOTE: `import 'server-only'` is intentionally NOT here — the Better Auth CLI
// cannot resolve a config that imports it, and this file is the generation
// source (`npm run auth:schema:generate`). Server-only consumption is enforced
// two ways: app code imports the auth instance from `lib/auth` (index.ts, which
// carries `server-only`), and ESLint boundaries forbid components/client
// modules from importing `@/lib/auth/*`. This module also imports `pg`, which
// cannot be bundled for the browser.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://localhost:5432/placeholder',
})

export const auth = betterAuth({
  // The adapter requires the generated schema object; without it every model
  // lookup (and therefore every sign-in) fails at runtime.
  database: drizzleAdapter(drizzle(pool), {
    provider: 'pg',
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
})
