import type { NextRequest } from 'next/server';

/**
 * Verifies a Vercel Cron / external scheduler request.
 *
 * Every cron route performs privileged maintenance, so the caller must prove
 * knowledge of CRON_SECRET. The `x-vercel-cron` header is useful telemetry,
 * but it is not an authentication factor at the application boundary.
 *
 * See #23.
 */
export function verifyCronRequest(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return process.env.NODE_ENV !== 'production';

  const auth = request.headers.get('authorization') ?? '';
  return auth === `Bearer ${expected}`;
}
