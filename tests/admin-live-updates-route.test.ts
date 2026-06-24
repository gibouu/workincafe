import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { actorOf, createMockClient } from './helpers/mock-supabase';

const mocks = vi.hoisted(() => ({
  getRequestActor: vi.fn(),
  isEmailAllowlisted: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/auth/request-actor', () => ({
  getRequestActor: mocks.getRequestActor,
}));

vi.mock('@/lib/auth/admin-allowlist', () => ({
  isEmailAllowlisted: mocks.isEmailAllowlisted,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}));

const ADMIN = { id: '00000000-0000-0000-0000-0000000000aa', email: 'admin@example.com' };
const UPDATE_USER_ID = '00000000-0000-0000-0000-000000000321';

const load = () => import('@/app/api/admin/live-updates/route');

function get(): NextRequest {
  return new NextRequest('http://test.local/api/admin/live-updates');
}

beforeEach(() => {
  vi.clearAllMocks();
  const actorDb = createMockClient({
    tables: {
      users: { data: { is_admin: true }, error: null },
    },
  });
  mocks.getRequestActor.mockResolvedValue(actorOf(actorDb, ADMIN));
  mocks.isEmailAllowlisted.mockReturnValue(true);
});

describe('GET /api/admin/live-updates', () => {
  it('hydrates submitter emails with exact auth lookups', async () => {
    const admin = createMockClient({
      tables: {
        live_updates: {
          data: [
            {
              id: 'live-1',
              place_id: 'place-1',
              user_id: UPDATE_USER_ID,
              noise_level: 'quiet',
              seating_availability: 'plenty',
              temperature: 'comfortable',
              outlets: 'many',
              rotating_question: 'line',
              rotating_answer: 'none',
              created_at: '2026-01-01T00:00:00Z',
              is_demo: false,
            },
          ],
          count: 1,
          error: null,
        } as never,
        places: {
          data: [{ id: 'place-1', name: 'Cafe One', city: 'Toronto', country: 'Canada' }],
          error: null,
        },
      },
      listUsers: { users: [] },
      authUsersById: {
        [UPDATE_USER_ID]: { id: UPDATE_USER_ID, email: 'live@example.com' },
      },
    });
    mocks.createAdminClient.mockReturnValue(admin);

    const { GET } = await load();
    const res = await GET(get());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(admin.auth.admin.getUserById).toHaveBeenCalledWith(UPDATE_USER_ID);
    expect(admin.auth.admin.listUsers).not.toHaveBeenCalled();
    expect(body.updates[0]).toMatchObject({
      id: 'live-1',
      user_email: 'live@example.com',
      place_label: 'Cafe One · Toronto, Canada',
    });
  });
});
