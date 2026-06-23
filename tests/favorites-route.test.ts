import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { actorOf, callsFor, createMockClient } from './helpers/mock-supabase';

const mocks = vi.hoisted(() => ({
  getRequestActor: vi.fn(),
  resolvePlaceIdForActor: vi.fn(),
}));

vi.mock('@/lib/auth/request-actor', () => ({
  getRequestActor: mocks.getRequestActor,
  resolvePlaceIdForActor: mocks.resolvePlaceIdForActor,
  upsertWithDemoFlag: vi.fn(),
}));

const load = () => import('@/app/api/favorites/route');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolvePlaceIdForActor.mockImplementation(
    async (_db: unknown, placeId: string) => `resolved-${placeId}`,
  );
});

describe('DELETE /api/favorites', () => {
  it('deletes favorites by the actor-resolved place id', async () => {
    const db = createMockClient({ tables: { favorites: { data: null, error: null } } });
    mocks.getRequestActor.mockResolvedValue({
      ...actorOf(db, { id: 'user-1', email: 'user@example.com' }),
      isDemo: true,
    });

    const { DELETE } = await load();
    const res = await DELETE(
      new NextRequest('http://test.local/api/favorites?place_id=demo-place', {
        method: 'DELETE',
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mocks.resolvePlaceIdForActor).toHaveBeenCalledWith(db, 'demo-place', true);
    expect(callsFor(db, 'favorites', 'eq').map((call) => call.args)).toContainEqual([
      'place_id',
      'resolved-demo-place',
    ]);
  });
});
