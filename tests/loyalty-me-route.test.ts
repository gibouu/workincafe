import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { actorOf, createMockClient } from './helpers/mock-supabase';

const mocks = vi.hoisted(() => ({
  getRequestActor: vi.fn(),
}));

vi.mock('@/lib/auth/request-actor', () => ({
  getRequestActor: mocks.getRequestActor,
}));

const USER = { id: '00000000-0000-0000-0000-000000000031', email: 'user@example.com' };

function get(): NextRequest {
  return new NextRequest('http://test.local/api/loyalty/me');
}

const load = () => import('@/app/api/loyalty/me/route');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/loyalty/me', () => {
  it('returns 401 when signed out', async () => {
    mocks.getRequestActor.mockResolvedValue(actorOf(createMockClient(), null));

    const { GET } = await load();
    const res = await GET(get());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthenticated' });
  });

  it('does not report configured database failures as successful zero progress', async () => {
    const db = createMockClient();
    db.rpc.mockResolvedValue({
      data: null,
      error: { code: 'XX000', message: 'database unavailable' },
    });
    mocks.getRequestActor.mockResolvedValue(actorOf(db, USER));

    const { GET } = await load();
    const res = await GET(get());

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'loyalty lookup failed' });
  });

  it('keeps the zero-progress fallback for an unapplied loyalty schema', async () => {
    const db = createMockClient();
    db.rpc.mockResolvedValue({
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function public.user_point_balance' },
    });
    mocks.getRequestActor.mockResolvedValue(actorOf(db, USER));

    const { GET } = await load();
    const res = await GET(get());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      balance: 0,
      distinct_places: 0,
      freebie_unlocked: false,
      points_to_unlock: 20,
      places_to_unlock: 5,
    });
  });
});
