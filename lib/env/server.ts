import { z } from 'zod'

// Server-only environment validation (Decision 17: split lib/env/server|public).
// Lazy + memoized so it is validated at request time, never at build time — the
// public read routes are force-dynamic and never prerender. Never import this
// from Client Components or browser-safe modules (ESLint boundary enforces it);
// it may reference secrets. `DATABASE_URL` is the pooled application connection
// (local Docker PostGIS in dev; Neon pooled URL once provisioned).
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required for database access'),
  // Server-side Google Places key (GP-1 seeding). Feature-conditional
  // (Decision 17/20): optional here so unrelated commands, tests, and preview
  // deployments never demand it — the seeding path itself fails closed with a
  // clear operator-facing message when it is absent. Production-only by
  // default; never exposed to the browser.
  GOOGLE_PLACES_SERVER_KEY: z.string().min(1).optional(),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

let cached: ServerEnv | null = null

export function serverEnv(): ServerEnv {
  if (cached === null) {
    cached = serverEnvSchema.parse(process.env)
  }
  return cached
}
