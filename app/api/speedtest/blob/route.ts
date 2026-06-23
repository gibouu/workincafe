import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * GET /api/speedtest/blob[?size=5]  →  5MB (default) random bytes, no-cache.
 * Client measures download Mbps by timing the fetch.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawSize = searchParams.get('size');
  const requestedMb = rawSize === null ? 5 : Number(rawSize);
  if (!Number.isFinite(requestedMb) || requestedMb < 1) {
    return NextResponse.json({ error: 'size must be a number from 1 to 20' }, { status: 400 });
  }
  const mb = Math.min(20, requestedMb);
  const bytes = mb * 1024 * 1024;

  // Stream the bytes in 64KB chunks to avoid allocating ~5MB at once.
  const chunkSize = 64 * 1024;
  const totalChunks = Math.ceil(bytes / chunkSize);
  let sent = 0;
  let i = 0;

  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i >= totalChunks) {
        controller.close();
        return;
      }
      const size = Math.min(chunkSize, bytes - sent);
      const chunk = new Uint8Array(size);
      crypto.getRandomValues(chunk);
      controller.enqueue(chunk);
      sent += size;
      i++;
    },
  });

  return new NextResponse(stream, {
    headers: {
      'content-type': 'application/octet-stream',
      'content-length': String(bytes),
      'cache-control': 'no-store, no-cache, must-revalidate',
      'x-workin-cafe': 'speedtest-blob',
    },
  });
}
