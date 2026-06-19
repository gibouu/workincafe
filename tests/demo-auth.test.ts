import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isDemoAuthEnabled,
  signDemoSession,
  verifyDemoSessionToken,
} from '@/lib/demo/auth';

const session = {
  userId: '00000000-0000-0000-0000-000000000215',
  email: 'demo@example.com',
  name: 'Demo User',
  isDemo: true as const,
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('demo auth', () => {
  it('does not enable production demo auth without an explicit private secret', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DEMO_AUTH_ENABLED', 'true');
    vi.stubEnv('DEMO_AUTH_SECRET', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key-is-not-a-demo-secret');

    expect(isDemoAuthEnabled()).toBe(false);
  });

  it('signs and verifies production demo sessions with DEMO_AUTH_SECRET', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DEMO_AUTH_ENABLED', 'true');
    vi.stubEnv('DEMO_AUTH_SECRET', 'private-demo-secret');

    const token = await signDemoSession(session);

    await expect(verifyDemoSessionToken(token)).resolves.toEqual(session);
  });

  it('rejects local fallback tokens in production without DEMO_AUTH_SECRET', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('DEMO_AUTH_SECRET', '');
    const token = await signDemoSession(session);

    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DEMO_AUTH_ENABLED', 'true');
    vi.stubEnv('DEMO_AUTH_SECRET', '');

    await expect(verifyDemoSessionToken(token)).resolves.toBeNull();
  });
});
