// Google Maps JavaScript bootstrap (Decision 10 / 24c-G4): the official
// Dynamic Library Import pattern implemented in-repo — no loader dependency.
// Browser-safe only: the referrer-restricted browser key (Decision 20) is the
// sole credential that ever reaches this module, and the contained window/
// script mutation lives only here (Decision 15 imperative boundary — no map
// handle or provider global escapes the adapter modules).

const MAPS_JS_VERSION = 'weekly'

interface MapsGlobal {
  importLibrary?: (name: string) => Promise<unknown>
  __ib__?: () => void
}

/**
 * Install the `google.maps.importLibrary` stub once; the Maps JS script is
 * injected on the first actual `importLibrary` call and replaces the stub.
 * Safe to call repeatedly (subsequent calls are no-ops).
 */
export function bootstrapGoogleMaps(apiKey: string): void {
  if (typeof window === 'undefined') return
  const w = window as unknown as { google?: { maps?: MapsGlobal } }
  w.google ??= {}
  w.google.maps ??= {}
  const maps = w.google.maps
  if (maps.importLibrary) return

  const requested = new Set<string>()
  let loading: Promise<void> | null = null
  const loadScript = () =>
    (loading ??= new Promise<void>((resolve, reject) => {
      const params = new URLSearchParams({
        key: apiKey,
        v: MAPS_JS_VERSION,
        libraries: [...requested].join(','),
        callback: 'google.maps.__ib__',
      })
      maps.__ib__ = resolve
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`
      script.async = true
      script.onerror = () => reject(new Error('Google Maps JavaScript failed to load'))
      document.head.append(script)
    }))

  maps.importLibrary = (name: string) => {
    requested.add(name)
    // After the script loads it replaces `importLibrary`; re-read and delegate.
    return loadScript().then(() => maps.importLibrary!(name))
  }
}

/** Typed library entry points — the only Maps imports features may use. */
export function importMapsLibrary(): Promise<{ Map: typeof google.maps.Map }> {
  return google.maps.importLibrary('maps')
}

export function importMarkerLibrary(): Promise<{
  AdvancedMarkerElement: typeof google.maps.marker.AdvancedMarkerElement
  PinElement: typeof google.maps.marker.PinElement
}> {
  return google.maps.importLibrary('marker')
}
