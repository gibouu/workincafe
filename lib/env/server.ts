import { z } from 'zod'

// Server-only environment validation (Decision 17: split lib/env/server|public).
// Lazy + memoized so it is validated at request time, never at build time — the
// public read routes are force-dynamic and never prerender. Never import this
// from Client Components or browser-safe modules (ESLint boundary enforces it);
// it may reference secrets. `DATABASE_URL` is the pooled application connection
// (local Docker PostGIS in dev; Neon pooled URL once provisioned).
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required for database access'),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

let cached: ServerEnv | null = null

export function serverEnv(): ServerEnv {
  if (cached === null) {
    cached = serverEnvSchema.parse(process.env)
  }
  return cached
}
