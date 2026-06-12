/**
 * Table-driven auth-gate tests for every /api/admin route (#183).
 *
 * Contract under test (identical across routes, some via a local
 * requireAdmin helper): signed-out → 401; signed-in but not on the
 * ADMIN_EMAIL_ALLOWLIST → 403; allowlisted but users.is_admin=false → 403.
 * A broken gate on any of these routes is full-data exposure, so every
 * route/method pair is asserted, not a sample.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createMockClient, actorOf } from './helpers/mock-supabase';

const mocks = vi.hoisted(() => ({
  getRequestActor: vi.fn(),
  isEmailAllowlisted: vi.fn(),
}));

vi.mock('@/lib/auth/request-actor', () => ({
  getRequestActor: mocks.getRequestActor,
}));
vi.mock('@/lib/auth/admin-allowlist', () => ({
  isEmailAllowlisted: mocks.isEmailAllowlisted,
  adminAllowlistEnabled: () => true,
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({})),
}));

type Handler = (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) => Promise<Response>;

interface RouteCase {
  name: string;
  method: string;
  handler: string;
  load: () => Promise<unknown>;
}

const ROUTES: RouteCase[] = [
  { name: 'GET /api/admin/places', method: 'GET', handler: 'GET', load: () => import('@/app/api/admin/places/route') },
  { name: 'GET /api/admin/reviews', method: 'GET', handler: 'GET', load: () => import('@/app/api/admin/reviews/route') },
  { name: 'GET /api/admin/live-updates', method: 'GET', handler: 'GET', load: () => import('@/app/api/admin/live-updates/route') },
  { name: 'GET /api/admin/activity', method: 'GET', handler: 'GET', load: () => import('@/app/api/admin/activity/route') },
  { name: 'POST /api/admin/users/search', method: 'POST', handler: 'POST', load: () => import('@/app/api/admin/users/search/route') },
  { name: 'POST /api/admin/place-requests/bulk', method: 'POST', handler: 'POST', load: () => import('@/app/api/admin/place-requests/bulk/route') },
  { name: 'POST /api/admin/flagged-reviews/bulk', method: 'POST', handler: 'POST', load: () => import('@/app/api/admin/flagged-reviews/bulk/route') },
  { name: 'POST /api/admin/place-requests/[id]/decision', method: 'POST', handler: 'POST', load: () => import('@/app/api/admin/place-requests/[id]/decision/route') },
  { name: 'POST /api/admin/flagged-reviews/[id]/decision', method: 'POST', handler: 'POST', load: () => import('@/app/api/admin/flagged-reviews/[id]/decision/route') },
  { name: 'POST /api/admin/places/[id]/merge-into', method: 'POST', handler: 'POST', load: () => import('@/app/api/admin/places/[id]/merge-into/route') },
  { name: 'POST /api/admin/users/[id]/admin', method: 'POST', handler: 'POST', load: () => import('@/app/api/admin/users/[id]/admin/route') },
  { name: 'PATCH /api/admin/places/[id]', method: 'PATCH', handler: 'PATCH', load: () => import('@/app/api/admin/places/[id]/route') },
  { name: 'DELETE /api/admin/places/[id]', method: 'DELETE', handler: 'DELETE', load: () => import('@/app/api/admin/places/[id]/route') },
  { name: 'PATCH /api/admin/reviews/[id]', method: 'PATCH', handler: 'PATCH', load: () => import('@/app/api/admin/reviews/[id]/route') },
  { name: 'DELETE /api/admin/reviews/[id]', method: 'DELETE', handler: 'DELETE', load: () => import('@/app/api/admin/reviews/[id]/route') },
];

const USER = { id: '00000000-0000-0000-0000-0000000000aa', email: 'admin@example.com' };
const CTX = { params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000001' }) };

function makeRequest(method: string): NextRequest {
  return new NextRequest('http://test.local/api/admin/x', {
    method,
    headers: { 'content-type': 'application/json' },
    ...(method === 'GET' || method === 'DELETE' ? {} : { body: JSON.stringify({}) }),
  });
}

describe.each(ROUTES)('$name', ({ method, handler, load }) => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when signed out', async () => {
    mocks.getRequestActor.mockResolvedValue(actorOf(createMockClient(), null));
    mocks.isEmailAllowlisted.mockReturnValue(true);
    const mod = (await load()) as Record<string, Handler>;
    const res = await mod[handler](makeRequest(method), CTX);
    expect(res.status).toBe(401);
  });

  it('returns 403 when email is not allowlisted', async () => {
    mocks.getRequestActor.mockResolvedValue(actorOf(createMockClient(), USER));
    mocks.isEmailAllowlisted.mockReturnValue(false);
    const mod = (await load()) as Record<string, Handler>;
    const res = await mod[handler](makeRequest(method), CTX);
    expect(res.status).toBe(403);
  });

  it('returns 403 when allowlisted but not is_admin', async () => {
    const db = createMockClient({
      tables: { users: { data: { is_admin: false }, error: null } },
    });
    mocks.getRequestActor.mockResolvedValue(actorOf(db, USER));
    mocks.isEmailAllowlisted.mockReturnValue(true);
    const mod = (await load()) as Record<string, Handler>;
    const res = await mod[handler](makeRequest(method), CTX);
    expect(res.status).toBe(403);
  });
});
