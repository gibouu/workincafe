/**
 * Client-side Wi-Fi speed test. Runs against our own edge endpoints so we control
 * the payload size. Reports download + upload in Mbps and ping in ms.
 *
 * Uses parallel streams + a duration window with a TCP warmup, the same way
 * Ookla and friends do — a single HTTP/1.1 connection can't saturate a
 * high-bandwidth link because TCP slow-start caps the in-flight bytes per
 * connection, so a single 5 MB blob on Gbps Wi-Fi reports a fantasy number
 * that's mostly measurement error.
 */

export interface SpeedResult {
  download_mbps: number;
  upload_mbps: number;
  ping_ms: number;
  connection_type: string | null;
}

export type SpeedtestPhase = 'ping' | 'download' | 'upload';

export class SpeedtestError extends Error {
  phase: SpeedtestPhase;
  cause?: unknown;
  constructor(phase: SpeedtestPhase, message: string, cause?: unknown) {
    super(message);
    this.name = 'SpeedtestError';
    this.phase = phase;
    this.cause = cause;
  }
}

const DOWNLOAD_DURATION_MS = 8000;
const DOWNLOAD_MAX_BYTES = 200 * 1024 * 1024; // safety cap
const DOWNLOAD_CHUNK_MB = 10;
const DOWNLOAD_PARALLELISM = 4;

const UPLOAD_DURATION_MS = 6000;
const UPLOAD_MAX_BYTES = 100 * 1024 * 1024; // safety cap
const UPLOAD_CHUNK_BYTES = 2 * 1024 * 1024;
const UPLOAD_PARALLELISM = 3;

export async function pingMs(samples = 4): Promise<number> {
  const results: number[] = [];
  for (let i = 0; i < samples; i++) {
    const t0 = performance.now();
    const resp = await fetch(`/api/speedtest/ping?t=${Date.now()}`, {
      method: 'HEAD',
      cache: 'no-store',
    });
    if (!resp.ok && resp.status !== 204) {
      throw new SpeedtestError('ping', `ping failed: ${resp.status}`);
    }
    results.push(performance.now() - t0);
  }
  results.sort((a, b) => a - b);
  return Math.round(results[Math.floor(results.length / 2)]);
}

async function drainBlob(
  sizeMB: number,
  onBytes: (n: number) => boolean,
): Promise<void> {
  const resp = await fetch(
    `/api/speedtest/blob?size=${sizeMB}&t=${Date.now()}-${Math.random()}`,
    { cache: 'no-store' },
  );
  if (!resp.ok || !resp.body) {
    throw new SpeedtestError('download', `download failed: ${resp.status}`);
  }
  const reader = resp.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value && !onBytes(value.byteLength)) {
      await reader.cancel();
      break;
    }
  }
}

export async function downloadMbps(
  durationMs = DOWNLOAD_DURATION_MS,
  maxBytes = DOWNLOAD_MAX_BYTES,
  parallelism = DOWNLOAD_PARALLELISM,
): Promise<number> {
  // TCP warmup — discard the first small fetch so slow-start doesn't skew
  // the actual measurement window.
  await drainBlob(1, () => true).catch(() => null);

  const start = performance.now();
  const deadline = start + durationMs;
  let totalBytes = 0;
  const onBytes = (n: number) => {
    totalBytes += n;
    return totalBytes < maxBytes && performance.now() < deadline;
  };

  const streams = Array.from({ length: parallelism }, async () => {
    while (performance.now() < deadline && totalBytes < maxBytes) {
      try {
        await drainBlob(DOWNLOAD_CHUNK_MB, onBytes);
      } catch {
        // One stream failing shouldn't kill the whole measurement.
        break;
      }
    }
  });
  await Promise.all(streams);

  const seconds = (performance.now() - start) / 1000;
  if (seconds <= 0 || totalBytes === 0) {
    throw new SpeedtestError('download', 'no data transferred');
  }
  return Math.round(((totalBytes * 8) / seconds / 1_000_000) * 10) / 10;
}

async function postPayload(payload: Blob): Promise<void> {
  const resp = await fetch('/api/speedtest/upload', {
    method: 'POST',
    body: payload,
    headers: { 'content-type': 'application/octet-stream' },
    cache: 'no-store',
  });
  if (!resp.ok) throw new SpeedtestError('upload', `upload failed: ${resp.status}`);
}

export async function uploadMbps(
  durationMs = UPLOAD_DURATION_MS,
  maxBytes = UPLOAD_MAX_BYTES,
  chunkBytes = UPLOAD_CHUNK_BYTES,
  parallelism = UPLOAD_PARALLELISM,
): Promise<number> {
  // A zero-filled buffer measures throughput just as well — the server returns
  // octet-stream with `cache-control: no-store`, so there's no compression.
  // We avoid `crypto.getRandomValues` because browsers cap that call at 65536
  // bytes per invocation.
  const payload = new Blob([new Uint8Array(chunkBytes)], { type: 'application/octet-stream' });

  // Warmup
  await postPayload(payload).catch(() => null);

  const start = performance.now();
  const deadline = start + durationMs;
  let totalBytes = 0;

  const streams = Array.from({ length: parallelism }, async () => {
    while (performance.now() < deadline && totalBytes < maxBytes) {
      try {
        await postPayload(payload);
        totalBytes += chunkBytes;
      } catch {
        break;
      }
    }
  });
  await Promise.all(streams);

  const seconds = (performance.now() - start) / 1000;
  if (seconds <= 0 || totalBytes === 0) {
    throw new SpeedtestError('upload', 'no data transferred');
  }
  return Math.round(((totalBytes * 8) / seconds / 1_000_000) * 10) / 10;
}

// Empirical calibration. Our parallel-stream HTTP test against an in-region
// Vercel edge serving cached random bytes consistently over-reports vs Ookla
// by ~25–35% (Ookla uses geo-distributed servers and accounts for protocol
// overhead). 0.75 brings the displayed number close to what the user sees on
// speedtest.net for the same connection. Re-tune if real-world data shifts.
const CALIBRATION_FACTOR = 0.75;

function calibrate(mbps: number): number {
  return Math.round(mbps * CALIBRATION_FACTOR * 10) / 10;
}

export interface RunOptions {
  onPhase?: (phase: SpeedtestPhase) => void;
}

async function runWithRetry<T>(
  phase: SpeedtestPhase,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch {
    try {
      return await fn();
    } catch (err2) {
      if (err2 instanceof SpeedtestError) throw err2;
      throw new SpeedtestError(
        phase,
        err2 instanceof Error ? err2.message : `${phase} failed`,
        err2,
      );
    }
  }
}

export async function runSpeedtest(opts: RunOptions = {}): Promise<SpeedResult> {
  opts.onPhase?.('ping');
  const p = await runWithRetry('ping', () => pingMs(4));
  opts.onPhase?.('download');
  const d = await runWithRetry('download', () => downloadMbps());
  opts.onPhase?.('upload');
  const u = await runWithRetry('upload', () => uploadMbps());
  const conn = (navigator as unknown as { connection?: { effectiveType?: string } }).connection;
  return {
    download_mbps: calibrate(d),
    upload_mbps: calibrate(u),
    ping_ms: p,
    connection_type: conn?.effectiveType ?? null,
  };
}
