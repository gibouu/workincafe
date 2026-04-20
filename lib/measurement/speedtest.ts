/**
 * Client-side Wi-Fi speed test. Runs against our own edge endpoints so we control
 * the payload size. Reports download + upload in Mbps and ping in ms.
 */

export interface SpeedResult {
  download_mbps: number;
  upload_mbps: number;
  ping_ms: number;
  connection_type: string | null;
}

export async function pingMs(samples = 3): Promise<number> {
  const results: number[] = [];
  for (let i = 0; i < samples; i++) {
    const t0 = performance.now();
    await fetch(`/api/speedtest/ping?t=${Date.now()}`, { method: 'HEAD', cache: 'no-store' });
    results.push(performance.now() - t0);
  }
  results.sort((a, b) => a - b);
  return Math.round(results[Math.floor(results.length / 2)]);
}

export async function downloadMbps(sizeMB = 5): Promise<number> {
  const bytes = sizeMB * 1024 * 1024;
  const t0 = performance.now();
  const resp = await fetch(`/api/speedtest/blob?size=${sizeMB}&t=${Date.now()}`, {
    cache: 'no-store',
  });
  if (!resp.ok || !resp.body) throw new Error(`speedtest blob failed: ${resp.status}`);
  const reader = resp.body.getReader();
  while (true) {
    const { done } = await reader.read();
    if (done) break;
  }
  const seconds = (performance.now() - t0) / 1000;
  return Math.round(((bytes * 8) / seconds / 1_000_000) * 10) / 10;
}

export async function uploadMbps(sizeMB = 2): Promise<number> {
  const size = sizeMB * 1024 * 1024;
  const payload = new Uint8Array(size);
  crypto.getRandomValues(payload);
  const t0 = performance.now();
  const resp = await fetch('/api/speedtest/upload', {
    method: 'POST',
    body: payload,
    headers: { 'content-type': 'application/octet-stream' },
    cache: 'no-store',
  });
  if (!resp.ok) throw new Error(`speedtest upload failed: ${resp.status}`);
  const seconds = (performance.now() - t0) / 1000;
  return Math.round(((size * 8) / seconds / 1_000_000) * 10) / 10;
}

export async function runSpeedtest(): Promise<SpeedResult> {
  const p = await pingMs(4);
  const d = await downloadMbps(5);
  const u = await uploadMbps(2);
  const conn = (navigator as unknown as { connection?: { effectiveType?: string } }).connection;
  return {
    download_mbps: d,
    upload_mbps: u,
    ping_ms: p,
    connection_type: conn?.effectiveType ?? null,
  };
}
