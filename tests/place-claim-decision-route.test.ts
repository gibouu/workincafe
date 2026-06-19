import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { actorOf, callsFor, createMockClient } from './helpers/mock-supabase';

const mocks = vi.hoisted(() => ({
  getRequestActor: vi.fn(),
  createAdminClient: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock('@/lib/auth/request-actor', () => ({ getRequestActor: mocks.getRequestActor }));
vi.mock('@/lib/auth/admin-allowlist', () => ({
  isEmailAllowlisted: () => true,
}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock('@/lib/email/send', () => ({ sendEmail: mocks.sendEmail }));

const ADMIN = {
  id: '00000000-0000-0000-0000-0000000000aa',
  email: 'admin@example.com',
};
const CLAIM_ID = '00000000-0000-0000-0000-000000000001';
const PLACE_ID = '00000000-0000-0000-0000-000000000002';
const CLAIMANT_ID = '00000000-0000-0000-0000-000000000003';

function post(body: unknown): NextRequest {
  return new NextRequest(`http://test.local/api/place-claims/${CLAIM_ID}/decision`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/place-claims/[id]/decision', () => {
  it('does not mark a claim approved when granting ownership fails', async () => {
    const authDb = createMockClient({
      tables: { users: { data: { is_admin: true }, error: null } },
    });
    mocks.getRequestActor.mockResolvedValue(actorOf(authDb, ADMIN));

    const admin = createMockClient({
      tables: {
        place_claims: {
          data: {
            id: CLAIM_ID,
            place_id: PLACE_ID,
            claimant_user_id: CLAIMANT_ID,
            claimant_email: null,
            status: 'pending',
          },
          error: null,
        },
        place_owners: {
          data: null,
          error: { message: 'foreign key violation' },
        },
      },
    });
    mocks.createAdminClient.mockReturnValue(admin);

    const { POST } = await import('@/app/api/place-claims/[id]/decision/route');
    const res = await POST(post({ decision: 'approved' }), {
      params: Promise.resolve({ id: CLAIM_ID }),
    });

    expect(res.status).toBe(500);
    expect(callsFor(admin, 'place_owners', 'insert')).toHaveLength(1);
    expect(callsFor(admin, 'place_claims', 'update')).toHaveLength(0);
  });
});
