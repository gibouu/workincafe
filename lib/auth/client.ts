import { createAuthClient } from 'better-auth/react'

// Browser-safe Better Auth client for operator sign-in / sign-out. Talks to the
// same-origin /api/auth/* endpoints; contains no server code or secrets. Used by
// Client Components under the operator surface. (Distinct from lib/auth/index.ts,
// which is the server-only auth instance.)
export const authClient = createAuthClient()
