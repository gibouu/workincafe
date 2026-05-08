export type PendingKind = 'review' | 'live-update' | 'checkin' | 'validate';

const KEY_PREFIX = 'wic:pending:';

function keyFor(kind: PendingKind): string {
  return `${KEY_PREFIX}${kind}`;
}

export interface PendingEnvelope<T = unknown> {
  kind: PendingKind;
  placeId: string;
  payload: T;
  savedAt: number;
}

export function savePending<T>(kind: PendingKind, placeId: string, payload: T): void {
  if (typeof window === 'undefined') return;
  const env: PendingEnvelope<T> = { kind, placeId, payload, savedAt: Date.now() };
  try {
    window.localStorage.setItem(keyFor(kind), JSON.stringify(env));
  } catch {
    // ignore storage errors
  }
}

export function consumePending<T>(kind: PendingKind): PendingEnvelope<T> | null {
  if (typeof window === 'undefined') return null;
  const k = keyFor(kind);
  try {
    const raw = window.localStorage.getItem(k);
    if (!raw) return null;
    window.localStorage.removeItem(k);
    return JSON.parse(raw) as PendingEnvelope<T>;
  } catch {
    return null;
  }
}

export function clearPending(kind: PendingKind): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(keyFor(kind));
  } catch {
    // ignore
  }
}

export function buildAuthRedirect(nextPath: string, marker: string): string {
  const sep = nextPath.includes('?') ? '&' : '?';
  const safeNext = `${nextPath}${sep}submit=${marker}`;
  return `/auth?next=${encodeURIComponent(safeNext)}`;
}
