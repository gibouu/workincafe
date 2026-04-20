import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'edge';

/**
 * POST /api/speedtest/upload  →  receive up to 2MB and discard; return size.
 * Client times the round-trip to compute upload Mbps.
 */
export async function POST(request: NextRequest) {
  const MAX = 2 * 1024 * 1024;
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX) {
    return NextResponse.json({ error: 'payload too large (2MB max)' }, { status: 413 });
  }

  // Drain without buffering more than necessary.
  let bytes = 0;
  const reader = request.body?.getReader();
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX) {
        return NextResponse.json({ error: 'payload too large (2MB max)' }, { status: 413 });
      }
    }
  }

  return NextResponse.json({ bytes }, { headers: { 'cache-control': 'no-store' } });
}
