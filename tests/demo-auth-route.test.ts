import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe('POST /api/auth/demo', () => {
  it('reuses demo users found after the first 500 auth users', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('DEMO_AUTH_EMAIL', 'demo@workin.cafe');
    vi.stubEnv('DEMO_AUTH_NAME', 'Demo Tester');

    const demoUser = {
      id: '00000000-0000-0000-0000-000000000215',
      email: 'demo@workin.cafe',
    };
    const fullPage = Array.from({ length: 100 }, (_, i) => ({
      id: `00000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
      email: `user-${i + 1}@example.com`,
    }));
    const listUsers = vi.fn(async ({ page }: { page: number; perPage: number }) => ({
      data: { users: page === 6 ? [demoUser] : fullPage },
      error: null,
    }));
    const createUser = vi.fn();
    const upsert = vi.fn(async () => ({ error: null }));
    const admin = {
      auth: { admin: { listUsers, createUser } },
      from: vi.fn(() => ({ upsert })),
    };
    mocks.createAdminClient.mockReturnValue(admin);

    const { POST } = await import('@/app/api/auth/demo/route');
    const res = await POST(
      new NextRequest('http://test.local/api/auth/demo', {
        method: 'POST',
        body: JSON.stringify({ next: '/profile' }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.user).toMatchObject({ id: demoUser.id, email: demoUser.email });
    expect(listUsers).toHaveBeenCalledTimes(6);
    expect(createUser).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalled();
  });
});
