/**
 * Client-side Wi-Fi speed test. Runs against our own edge endpoints so we control
 * the payload size. Reports download + upload in Mbps and ping in ms.
 *
 * Throughput phases use a duration-based loop with a TCP warmup so a fast
 * connection (where a 5 MB blob lands in <100 ms) doesn't return fantasy
 * Mbps numbers from a measurement-error denominator.
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

const DOWNLOAD_DURATION_MS = 5000;
const DOWNLOAD_MAX_BYTES = 50 * 1024 * 1024; // safety cap
const DOWNLOAD_CHUNK_MB = 10;

const UPLOAD_DURATION_MS = 4000;
const UPLOAD_MAX_BYTES = 25 * 1024 * 1024; // safety cap
const UPLOAD_CHUNK_BYTES = 2 * 1024 * 1024;

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

async function drainBlob(sizeMB: number, onBytes: (n: number) => boolean): Promise<void> {
  const resp = await fetch(`/api/speedtest/blob?size=${sizeMB}&t=${Date.now()}-${Math.random()}`, {
    cache: 'no-store',
  });
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
): Promise<number> {
  // TCP warmup: discard the first small fetch so slow-start doesn't skew the measurement.
  await drainBlob(1, () => true).catch(() => null);

  const start = performance.now();
  const deadline = start + durationMs;
  let totalBytes = 0;

  while (performance.now() < deadline && totalBytes < maxBytes) {
    await drainBlob(DOWNLOAD_CHUNK_MB, (n) => {
      totalBytes += n;
      return totalBytes < maxBytes && performance.now() < deadline;
    });
  }

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

  while (performance.now() < deadline && totalBytes < maxBytes) {
    await postPayload(payload);
    totalBytes += chunkBytes;
  }

  const seconds = (performance.now() - start) / 1000;
  if (seconds <= 0 || totalBytes === 0) {
    throw new SpeedtestError('upload', 'no data transferred');
  }
  return Math.round(((totalBytes * 8) / seconds / 1_000_000) * 10) / 10;
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
    download_mbps: d,
    upload_mbps: u,
    ping_ms: p,
    connection_type: conn?.effectiveType ?? null,
  };
}
