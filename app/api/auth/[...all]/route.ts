import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/lib/auth'

// Better Auth's Next.js route handler — mounts sign-in / sign-out / session
// endpoints under /api/auth/* (Decision 8: operators only, public sign-up
// disabled in the auth config). Authorization (an active `operators` row) is
// enforced separately server-side.
export const { GET, POST } = toNextJsHandler(auth)
