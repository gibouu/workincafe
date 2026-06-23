import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { actorOf, createMockClient } from './helpers/mock-supabase';

const mocks = vi.hoisted(() => ({
  getRequestActor: vi.fn(),
}));

vi.mock('@/lib/auth/request-actor', () => ({
  getRequestActor: mocks.getRequestActor,
}));

const USER = {
  id: '00000000-0000-0000-0000-000000000069',
  email: 'user@example.com',
};

function put(body: unknown): NextRequest {
  return new NextRequest('http://test.local/api/friend-profiles', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const load = () => import('@/app/api/friend-profiles/route');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PUT /api/friend-profiles', () => {
  it('does not report success when the profile table is missing', async () => {
    const db = createMockClient({
      tables: {
        friend_profiles: {
          data: null,
          error: { code: '42P01', message: 'relation does not exist' },
        },
      },
    });
    mocks.getRequestActor.mockResolvedValue(actorOf(db, USER));

    const { PUT } = await load();
    const res = await PUT(put({ occupation: 'Designer' }));

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'friend profiles unavailable' });
  });
});
