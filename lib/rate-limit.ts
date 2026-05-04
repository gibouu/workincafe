/**
 * Per-key in-memory token bucket. Bounds obvious spam without new infra.
 *
 * Caveats:
 *   - State lives inside one Vercel Function instance — a determined
 *     attacker bouncing across cold starts gets more budget. We rely on
 *     Vercel's default low concurrency and the auth gate on every write
 *     route as the real defense; this is a soft cap on top.
 *   - For real abuse mitigation, swap the Map for Vercel KV / Upstash
 *     Redis later.
 *
 * Usage:
 *   const r = rateLimit('cloudinary-sign', userId, { capacity: 30, windowMs: 60_000 });
 *   if (!r.ok) return NextResponse.json({ error: 'too many requests' },
 *     { status: 429, headers: { 'retry-after': String(r.retryAfterSec) } });
 */

interface Bucket {
  tokens: number;
  updated: number;
}

interface Config {
  /** Max tokens / window. */
  capacity: number;
  /** Refill window in ms. */
  windowMs: number;
}

interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

const buckets = new Map<string, Bucket>();
// Hard upper bound on map size to avoid memory growth on a hot instance.
const MAX_BUCKETS = 5000;

export function rateLimit(action: string, key: string, cfg: Config): RateLimitResult {
  if (!key) {
    // Anonymous: deny aggressively. Better to error politely than to let
    // unidentified callers spam us.
    return { ok: false, remaining: 0, retryAfterSec: cfg.windowMs / 1000 };
  }
  const id = `${action}:${key}`;
  const now = Date.now();
  let bucket = buckets.get(id);

  if (!bucket) {
    if (buckets.size >= MAX_BUCKETS) evictOldest(now);
    bucket = { tokens: cfg.capacity, updated: now };
    buckets.set(id, bucket);
  } else {
    const elapsed = now - bucket.updated;
    if (elapsed > 0) {
      const refill = (elapsed / cfg.windowMs) * cfg.capacity;
      bucket.tokens = Math.min(cfg.capacity, bucket.tokens + refill);
      bucket.updated = now;
    }
  }

  if (bucket.tokens < 1) {
    const tokensShort = 1 - bucket.tokens;
    const retryAfterMs = (tokensShort / cfg.capacity) * cfg.windowMs;
    return { ok: false, remaining: 0, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }
  bucket.tokens -= 1;
  return { ok: true, remaining: Math.floor(bucket.tokens), retryAfterSec: 0 };
}

function evictOldest(now: number) {
  let oldestId: string | null = null;
  let oldestUpdated = Infinity;
  for (const [k, b] of buckets) {
    if (b.updated < oldestUpdated) {
      oldestId = k;
      oldestUpdated = b.updated;
    }
  }
  if (oldestId) buckets.delete(oldestId);
  // Drop anything that's been idle for an hour regardless.
  for (const [k, b] of buckets) {
    if (now - b.updated > 60 * 60 * 1000) buckets.delete(k);
  }
}
