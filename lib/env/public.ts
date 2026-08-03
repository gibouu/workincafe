import { z } from 'zod'

// Browser-safe public environment (Decision 17: split lib/env/server|public).
// NEXT_PUBLIC_* values are inlined at build time, so each is referenced
// literally — never through dynamic keys. Feature-conditional (Decision 20
// flags-off posture): both Maps values are optional, and when either is absent
// the public map fails closed to the list-only experience — previews without a
// safely referrer-restricted key simply render no map. This module never
// contains secrets; the browser key is public by design and protected by its
// referrer + API restrictions, not by concealment.

const publicEnvSchema = z.object({
  googleMapsBrowserKey: z.string().min(1).optional(),
  googleMapsMapId: z.string().min(1).optional(),
})

export type PublicEnv = z.infer<typeof publicEnvSchema>

let cached: PublicEnv | null = null

export function publicEnv(): PublicEnv {
  if (cached === null) {
    cached = publicEnvSchema.parse({
      googleMapsBrowserKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY || undefined,
      googleMapsMapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || undefined,
    })
  }
  return cached
}

export interface MapsBrowserConfig {
  apiKey: string
  mapId: string
}

/** Both Maps values present → config; otherwise null (map disabled, fail
 * closed — Advanced Markers require a Map ID, so the key alone is not enough). */
export function mapsBrowserConfig(): MapsBrowserConfig | null {
  const env = publicEnv()
  return env.googleMapsBrowserKey && env.googleMapsMapId
    ? { apiKey: env.googleMapsBrowserKey, mapId: env.googleMapsMapId }
    : null
}
