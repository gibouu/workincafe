import type { NextRequest } from 'next/server';

/**
 * Verifies a Vercel Cron / external scheduler request.
 *
 * Vercel Cron auto-injects:
 *   - `x-vercel-cron: 1`
 *   - `Authorization: Bearer <project's CRON_SECRET>` (when CRON_SECRET is
 *     set as an env var in the project)
 *
 * We accept either signal as proof of identity:
 *   1. The Authorization bearer matches our CRON_SECRET (preferred — works
 *      from any caller, including a manual `curl` for ad-hoc runs).
 *   2. Or `x-vercel-cron: 1` is present (Vercel platform guarantees this
 *      header is unforgeable from outside the project).
 *
 * If neither holds, return false. The caller should respond 401.
 *
 * See #23.
 */
export function verifyCronRequest(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = request.headers.get('authorization') ?? '';
    if (auth === `Bearer ${expected}`) return true;
  }
  if (request.headers.get('x-vercel-cron') === '1') return true;
  return false;
}
