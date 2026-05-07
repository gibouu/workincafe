/**
 * Geolocation helpers — permission probe + last-known-position cache.
 *
 * Closes the silent-failure modes of `handleGeolocate`: we never know
 * whether the browser is going to prompt, deny outright, or succeed
 * silently with stale GPS. By caching last-known and probing
 * Permissions API up front we make the failure mode explicit instead
 * of leaving the user staring at a Boulogne-Billancourt pin.
 *
 * See #71.
 */

export type GeolocatePermissionState = 'unknown' | 'granted' | 'prompt' | 'denied' | 'unsupported';

/** Probe the Permissions API. Returns 'unknown' if it isn't available
 *  (older Safari iOS, some embedded webviews). The caller still has to
 *  attempt `getCurrentPosition` if the answer isn't a hard 'denied'. */
export async function probeGeolocationPermission(): Promise<GeolocatePermissionState> {
  if (typeof navigator === 'undefined') return 'unknown';
  if (!('geolocation' in navigator)) return 'unsupported';
  if (!('permissions' in navigator)) return 'unknown';
  try {
    // PermissionName 'geolocation' is in the spec; TS lib.dom narrows
    // it appropriately. The cast keeps this readable for older lib
    // bundlers.
    const status = await navigator.permissions.query({
      name: 'geolocation' as PermissionName,
    });
    return status.state;
  } catch {
    return 'unknown';
  }
}

/** Subscribe to Permissions API change events (e.g. user toggles
 *  Location Services in iOS Settings while the tab is open). Returns
 *  an unsubscribe fn or noop on unsupported browsers. */
export async function watchGeolocationPermission(
  onChange: (state: GeolocatePermissionState) => void,
): Promise<() => void> {
  if (typeof navigator === 'undefined' || !('permissions' in navigator)) {
    return () => {};
  }
  try {
    const status = await navigator.permissions.query({
      name: 'geolocation' as PermissionName,
    });
    const handler = () => onChange(status.state);
    status.addEventListener('change', handler);
    return () => status.removeEventListener('change', handler);
  } catch {
    return () => {};
  }
}

const CACHE_KEY = 'wic:last-known-position';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CachedPosition {
  lat: number;
  lng: number;
  ts: number;
}

export function readCachedPosition(): { lat: number; lng: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedPosition>;
    if (
      typeof parsed.lat !== 'number' ||
      typeof parsed.lng !== 'number' ||
      typeof parsed.ts !== 'number'
    ) {
      return null;
    }
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return { lat: parsed.lat, lng: parsed.lng };
  } catch {
    return null;
  }
}

export function writeCachedPosition(lat: number, lng: number): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: CachedPosition = { lat, lng, ts: Date.now() };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* quota exceeded — non-fatal */
  }
}

export function clearCachedPosition(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    /* noop */
  }
}

/** Map a `GeolocationPositionError.code` to a stable string for logs
 *  + UI copy. The numeric codes are 1/2/3 per the W3C spec. */
export function geolocationErrorLabel(code: number): string {
  switch (code) {
    case 1:
      return 'PERMISSION_DENIED';
    case 2:
      return 'POSITION_UNAVAILABLE';
    case 3:
      return 'TIMEOUT';
    default:
      return `UNKNOWN_${code}`;
  }
}
