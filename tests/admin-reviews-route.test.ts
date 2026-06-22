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
const REVIEW_USER_ID = '00000000-0000-0000-0000-000000000123';

function get(): NextRequest {
  return new NextRequest('http://test.local/api/admin/reviews');
}

const load = () => import('@/app/api/admin/reviews/route');

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

describe('GET /api/admin/reviews', () => {
  it('hydrates review submitter emails with exact auth lookups', async () => {
    const admin = createMockClient({
      tables: {
        reviews: {
          data: [
            {
              id: 'review-1',
              place_id: 'place-1',
              user_id: REVIEW_USER_ID,
              overall_rating: 8,
              comment: 'ok',
              is_hidden: false,
              source: 'user',
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
              upvotes_count: 0,
              geo_verified: true,
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
    });
    const getUserById = vi.fn(async (id: string) => ({
      data: { user: { id, email: 'reviewer@example.com' } },
      error: null,
    }));
    (admin.auth.admin as unknown as { getUserById: typeof getUserById }).getUserById = getUserById;
    mocks.createAdminClient.mockReturnValue(admin);

    const { GET } = await load();
    const res = await GET(get());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(getUserById).toHaveBeenCalledWith(REVIEW_USER_ID);
    expect(admin.auth.admin.listUsers).not.toHaveBeenCalled();
    expect(body.reviews[0]).toMatchObject({
      id: 'review-1',
      user_email: 'reviewer@example.com',
      place_label: 'Cafe One · Toronto, Canada',
    });
  });
});
