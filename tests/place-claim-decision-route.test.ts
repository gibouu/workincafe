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
const CLAIMANT_EMAIL = 'owner@example.com';

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

    const admin = createMockClient();
    admin.rpc.mockResolvedValue({
      data: null,
      error: { message: 'foreign key violation' },
    });
    mocks.createAdminClient.mockReturnValue(admin);

    const { POST } = await import('@/app/api/place-claims/[id]/decision/route');
    const res = await POST(post({ decision: 'approved' }), {
      params: Promise.resolve({ id: CLAIM_ID }),
    });

    expect(res.status).toBe(500);
    expect(admin.rpc).toHaveBeenCalledWith('decide_place_claim', {
      p_claim_id: CLAIM_ID,
      p_decision: 'approved',
      p_reviewer_id: ADMIN.id,
      p_rejection_reason: null,
    });
    expect(callsFor(admin, 'place_owners', 'insert')).toHaveLength(0);
    expect(callsFor(admin, 'place_claims', 'update')).toHaveLength(0);
  });

  it('returns 409 for stale decisions without sending email or granting ownership', async () => {
    const authDb = createMockClient({
      tables: { users: { data: { is_admin: true }, error: null } },
    });
    mocks.getRequestActor.mockResolvedValue(actorOf(authDb, ADMIN));

    const admin = createMockClient();
    admin.rpc.mockResolvedValue({
      data: null,
      error: { message: 'claim already decided' },
    });
    mocks.createAdminClient.mockReturnValue(admin);

    const { POST } = await import('@/app/api/place-claims/[id]/decision/route');
    const res = await POST(post({ decision: 'approved' }), {
      params: Promise.resolve({ id: CLAIM_ID }),
    });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'claim already decided' });
    expect(callsFor(admin, 'place_owners', 'insert')).toHaveLength(0);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('waits for the claim decision email attempt before returning success', async () => {
    const authDb = createMockClient({
      tables: { users: { data: { is_admin: true }, error: null } },
    });
    mocks.getRequestActor.mockResolvedValue(actorOf(authDb, ADMIN));

    const admin = createMockClient({
      tables: { places: { data: { name: 'Cafe Demo' }, error: null } },
    });
    admin.rpc.mockResolvedValue({
      data: [
        {
          id: CLAIM_ID,
          place_id: PLACE_ID,
          claimant_user_id: CLAIMANT_ID,
          claimant_email: CLAIMANT_EMAIL,
          status: 'approved',
        },
      ],
      error: null,
    });
    mocks.createAdminClient.mockReturnValue(admin);

    let emailFinished = false;
    mocks.sendEmail.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      emailFinished = true;
      return true;
    });

    const { POST } = await import('@/app/api/place-claims/[id]/decision/route');
    const res = await POST(post({ decision: 'approved' }), {
      params: Promise.resolve({ id: CLAIM_ID }),
    });

    expect(res.status).toBe(200);
    expect(emailFinished).toBe(true);
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: CLAIMANT_EMAIL,
        subject: expect.any(String),
      }),
    );
  });

  it('keeps claim decisions successful when the best-effort email rejects', async () => {
    const authDb = createMockClient({
      tables: { users: { data: { is_admin: true }, error: null } },
    });
    mocks.getRequestActor.mockResolvedValue(actorOf(authDb, ADMIN));

    const admin = createMockClient({
      tables: { places: { data: { name: 'Cafe Demo' }, error: null } },
    });
    admin.rpc.mockResolvedValue({
      data: [
        {
          id: CLAIM_ID,
          place_id: PLACE_ID,
          claimant_user_id: CLAIMANT_ID,
          claimant_email: CLAIMANT_EMAIL,
          status: 'rejected',
        },
      ],
      error: null,
    });
    mocks.createAdminClient.mockReturnValue(admin);
    mocks.sendEmail.mockRejectedValue(new Error('resend unavailable'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { POST } = await import('@/app/api/place-claims/[id]/decision/route');
    const res = await POST(post({ decision: 'rejected', rejection_reason: 'not enough proof' }), {
      params: Promise.resolve({ id: CLAIM_ID }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(consoleError).toHaveBeenCalledWith('claim decision email failed', expect.any(Error));

    consoleError.mockRestore();
  });
});
