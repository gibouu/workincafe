import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { verifyCronRequest } from '@/lib/cron/auth';

function cronRequest(headers: Record<string, string>): NextRequest {
  return new NextRequest('http://test.local/api/cron/expire-loyalty', {
    method: 'POST',
    headers,
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('verifyCronRequest', () => {
  it('does not trust forgeable Vercel cron headers without the shared secret', () => {
    vi.stubEnv('CRON_SECRET', 'cron-secret');

    expect(
      verifyCronRequest(
        cronRequest({
          'x-vercel-cron': '1',
        }),
      ),
    ).toBe(false);
  });

  it('accepts the configured bearer token', () => {
    vi.stubEnv('CRON_SECRET', 'cron-secret');

    expect(
      verifyCronRequest(
        cronRequest({
          authorization: 'Bearer cron-secret',
          'x-vercel-cron': '1',
        }),
      ),
    ).toBe(true);
  });
});
