import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { actorOf, callsFor, createMockClient } from './helpers/mock-supabase';

const mocks = vi.hoisted(() => ({
  getRequestActor: vi.fn(),
  isEmailAllowlisted: vi.fn(() => true),
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/auth/request-actor', () => ({ getRequestActor: mocks.getRequestActor }));
vi.mock('@/lib/auth/admin-allowlist', () => ({ isEmailAllowlisted: mocks.isEmailAllowlisted }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }));

const ACTOR = {
  id: '00000000-0000-0000-0000-0000000000aa',
  email: 'admin@example.com',
};
const TARGET_ID = '00000000-0000-0000-0000-0000000000bb';

function post(body: unknown): NextRequest {
  return new NextRequest(`http://test.local/api/admin/users/${TARGET_ID}/admin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/admin/users/[id]/admin', () => {
  it('changes admin status through the atomic database RPC', async () => {
    const authDb = createMockClient({
      tables: { users: { data: { is_admin: true }, error: null } },
    });
    mocks.getRequestActor.mockResolvedValue(actorOf(authDb, ACTOR));

    const admin = createMockClient();
    admin.rpc.mockResolvedValue({ data: null, error: null });
    mocks.createAdminClient.mockReturnValue(admin);

    const { POST } = await import('@/app/api/admin/users/[id]/admin/route');
    const res = await POST(post({ promote: false }), {
      params: Promise.resolve({ id: TARGET_ID }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(admin.rpc).toHaveBeenCalledWith('set_user_admin_status', {
      p_target_id: TARGET_ID,
      p_promote: false,
      p_actor_id: ACTOR.id,
    });
    expect(callsFor(admin, 'users', 'select')).toHaveLength(0);
    expect(callsFor(admin, 'users', 'update')).toHaveLength(0);
  });

  it('returns 409 when the RPC rejects removing the last admin', async () => {
    const authDb = createMockClient({
      tables: { users: { data: { is_admin: true }, error: null } },
    });
    mocks.getRequestActor.mockResolvedValue(actorOf(authDb, ACTOR));

    const admin = createMockClient();
    admin.rpc.mockResolvedValue({
      data: null,
      error: { message: "you're the only admin - promote someone else first" },
    });
    mocks.createAdminClient.mockReturnValue(admin);

    const { POST } = await import('@/app/api/admin/users/[id]/admin/route');
    const res = await POST(post({ promote: false }), {
      params: Promise.resolve({ id: ACTOR.id }),
    });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "you're the only admin - promote someone else first",
    });
  });
});
