import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getRequestActor: vi.fn(),
}));

vi.mock('@/lib/auth/request-actor', () => ({
  getRequestActor: mocks.getRequestActor,
}));

function request(): NextRequest {
  return new NextRequest('http://test.local/api/me');
}

const load = () => import('@/app/api/me/route');

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /api/me', () => {
  it('returns the signed-out shape when Supabase env is absent', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    mocks.getRequestActor.mockRejectedValue(new Error('supabase env missing'));

    const { GET } = await load();
    const res = await GET(request());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      signedIn: false,
      name: null,
      email: null,
      isDemo: false,
    });
    expect(mocks.getRequestActor).not.toHaveBeenCalled();
  });

  it('does not hide actor resolution failures when Supabase is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    mocks.getRequestActor.mockRejectedValue(new Error('supabase unavailable'));

    const { GET } = await load();

    await expect(GET(request())).rejects.toThrow('supabase unavailable');
  });
});
