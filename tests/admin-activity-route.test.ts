/**
 * GET /api/admin/activity (#183): union of both moderation sources,
 * sort-by-time, pagination shape, resolution parsing into action/detail,
 * and actor-email hydration for the visible page.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createMockClient, actorOf } from './helpers/mock-supabase';

const mocks = vi.hoisted(() => ({
  getRequestActor: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/auth/request-actor', () => ({ getRequestActor: mocks.getRequestActor }));
vi.mock('@/lib/auth/admin-allowlist', () => ({
  isEmailAllowlisted: () => true,
  adminAllowlistEnabled: () => true,
}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }));

const USER = { id: '00000000-0000-0000-0000-0000000000aa', email: 'admin@example.com' };

const placeRequests = [
  {
    id: 'pr1',
    name: 'Café A',
    status: 'approved',
    rejection_reason: null,
    reviewed_by: 'actor-1',
    reviewed_at: '2026-06-10T12:00:00Z',
  },
  {
    id: 'pr2',
    name: 'Café B',
    status: 'rejected',
    rejection_reason: 'duplicate',
    reviewed_by: 'actor-1',
    reviewed_at: '2026-06-08T12:00:00Z',
  },
];

const flaggedReviews = [
  {
    id: 'fr1',
    review_id: 'abcdef1234567890',
    status: 'approved',
    resolution: 'hide · spam',
    resolved_by: 'actor-2',
    resolved_at: '2026-06-09T12:00:00Z',
  },
  {
    id: 'fr2',
    review_id: 'fedcba0987654321',
    status: 'rejected',
    resolution: '',
    resolved_by: null,
    resolved_at: '2026-06-07T12:00:00Z',
  },
];

function setup() {
  const db = createMockClient({ tables: { users: { data: { is_admin: true }, error: null } } });
  mocks.getRequestActor.mockResolvedValue(actorOf(db, USER));
  const admin = createMockClient({
    tables: {
      place_requests: { data: placeRequests, error: null },
      flagged_reviews: { data: flaggedReviews, error: null },
    },
    listUsers: {
      users: [
        { id: 'actor-1', email: 'mod1@example.com' },
        { id: 'actor-2', email: 'mod2@example.com' },
      ],
    },
  });
  mocks.createAdminClient.mockReturnValue(admin);
  return admin;
}

function get(qs = ''): NextRequest {
  return new NextRequest(`http://test.local/api/admin/activity${qs}`, { method: 'GET' });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/admin/activity', () => {
  it('unions both sources and sorts by time descending', async () => {
    setup();
    const { GET } = await import('@/app/api/admin/activity/route');
    const res = await GET(get());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(4);
    expect(body.events.map((e: { id: string }) => e.id)).toEqual([
      'pr:pr1', // 06-10
      'fr:fr1', // 06-09
      'pr:pr2', // 06-08
      'fr:fr2', // 06-07
    ]);
  });

  it('parses resolution into action + detail, with dismiss fallback', async () => {
    setup();
    const { GET } = await import('@/app/api/admin/activity/route');
    const body = await (await GET(get())).json();
    const fr1 = body.events.find((e: { id: string }) => e.id === 'fr:fr1');
    expect(fr1).toMatchObject({
      kind: 'flagged_review',
      action: 'hide',
      detail: 'spam',
      target: 'review abcdef12',
    });
    const fr2 = body.events.find((e: { id: string }) => e.id === 'fr:fr2');
    expect(fr2.action).toBe('dismiss'); // empty resolution + rejected status
    expect(fr2.detail).toBeNull();
  });

  it('hydrates actor emails for the visible page', async () => {
    setup();
    const { GET } = await import('@/app/api/admin/activity/route');
    const body = await (await GET(get())).json();
    const pr1 = body.events.find((e: { id: string }) => e.id === 'pr:pr1');
    expect(pr1.actor_email).toBe('mod1@example.com');
    const fr1 = body.events.find((e: { id: string }) => e.id === 'fr:fr1');
    expect(fr1.actor_email).toBe('mod2@example.com');
  });

  it('paginates the merged list', async () => {
    setup();
    const { GET } = await import('@/app/api/admin/activity/route');
    const body = await (await GET(get('?page=1&pageSize=2'))).json();
    expect(body).toMatchObject({ total: 4, page: 1, pageSize: 2 });
    expect(body.events.map((e: { id: string }) => e.id)).toEqual(['pr:pr2', 'fr:fr2']);
  });

  it('kind=place_request returns only that source', async () => {
    setup();
    const { GET } = await import('@/app/api/admin/activity/route');
    const body = await (await GET(get('?kind=place_request'))).json();
    expect(body.total).toBe(2);
    expect(body.events.every((e: { kind: string }) => e.kind === 'place_request')).toBe(true);
  });

  it('caps pageSize at 100', async () => {
    setup();
    const { GET } = await import('@/app/api/admin/activity/route');
    const body = await (await GET(get('?pageSize=5000'))).json();
    expect(body.pageSize).toBe(100);
  });
});
