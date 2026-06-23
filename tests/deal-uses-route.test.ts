import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { actorOf, callsFor, createMockClient } from './helpers/mock-supabase';

const mocks = vi.hoisted(() => ({
  getRequestActor: vi.fn(),
  isOwnerOf: vi.fn(),
  createAdminClient: vi.fn(),
  awardPointForUse: vi.fn(),
}));

vi.mock('@/lib/auth/request-actor', () => ({
  getRequestActor: mocks.getRequestActor,
  isOwnerOf: mocks.isOwnerOf,
}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock('@/lib/loyalty/points', () => ({ awardPointForUse: mocks.awardPointForUse }));

const OWNER = {
  id: '00000000-0000-0000-0000-0000000000aa',
  email: 'owner@example.com',
};
const PURCHASE_ID = '00000000-0000-0000-0000-000000000001';
const PLACE_ID = '00000000-0000-0000-0000-000000000002';
const CUSTOMER_ID = '00000000-0000-0000-0000-000000000003';
const DEAL_ID = '00000000-0000-0000-0000-000000000004';

function post(body: unknown): NextRequest {
  return new NextRequest('http://test.local/api/deal-uses', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/deal-uses', () => {
  it('redeems through the transactional RPC instead of manual decrement and rollback', async () => {
    const db = createMockClient({
      tables: {
        deal_purchases: {
          data: {
            id: PURCHASE_ID,
            deal_id: DEAL_ID,
            place_id: PLACE_ID,
            user_id: CUSTOMER_ID,
            uses_remaining: 2,
            uses_total: 2,
            expires_at: null,
            deals: { title: 'Coffee Pack' },
          },
          error: null,
        },
      },
    });
    mocks.getRequestActor.mockResolvedValue(actorOf(db, OWNER));
    mocks.isOwnerOf.mockResolvedValue(true);

    const admin = createMockClient();
    admin.rpc.mockResolvedValue({
      data: { use_id: 'use-1', uses_remaining: 1, uses_total: 2 },
      error: null,
    });
    mocks.createAdminClient.mockReturnValue(admin);

    const { POST } = await import('@/app/api/deal-uses/route');
    const res = await POST(post({ qr_code: 'abc-123', notes: ' redeemed ' }));

    expect(res.status).toBe(200);
    expect(admin.rpc).toHaveBeenCalledWith('redeem_deal_purchase', {
      p_purchase_id: PURCHASE_ID,
      p_scanned_by: OWNER.id,
      p_notes: ' redeemed ',
      p_is_demo: false,
    });
    expect(callsFor(admin, 'deal_purchases', 'update')).toHaveLength(0);
    expect(callsFor(admin, 'deal_uses', 'insert')).toHaveLength(0);
    expect(mocks.awardPointForUse).not.toHaveBeenCalled();
    expect(callsFor(admin, 'point_events', 'insert')).toHaveLength(0);
  });

  it('rejects non-string redemption notes before redeeming', async () => {
    const db = createMockClient({
      tables: {
        deal_purchases: {
          data: {
            id: PURCHASE_ID,
            deal_id: DEAL_ID,
            place_id: PLACE_ID,
            user_id: CUSTOMER_ID,
            uses_remaining: 2,
            uses_total: 2,
            expires_at: null,
            deals: { title: 'Coffee Pack' },
          },
          error: null,
        },
      },
    });
    mocks.getRequestActor.mockResolvedValue(actorOf(db, OWNER));
    mocks.isOwnerOf.mockResolvedValue(true);

    const admin = createMockClient();
    mocks.createAdminClient.mockReturnValue(admin);

    const { POST } = await import('@/app/api/deal-uses/route');
    const res = await POST(post({ qr_code: 'abc-123', notes: { text: 'redeemed' } }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'notes must be a string' });
    expect(admin.rpc).not.toHaveBeenCalled();
  });
});
