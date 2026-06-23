import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { actorOf, callsFor, createMockClient } from './helpers/mock-supabase';

const mocks = vi.hoisted(() => ({
  getRequestActor: vi.fn(),
  createAdminClient: vi.fn(),
  generateRedemptionCode: vi.fn(),
}));

vi.mock('@/lib/auth/request-actor', () => ({
  getRequestActor: mocks.getRequestActor,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock('@/lib/loyalty/qr', () => ({
  generateRedemptionCode: mocks.generateRedemptionCode,
}));

const USER = {
  id: '00000000-0000-0000-0000-000000000227',
  email: 'user@example.com',
};
const DEAL_ID = '00000000-0000-0000-0000-000000000070';
const PLACE_ID = '00000000-0000-0000-0000-000000000071';

function post(): NextRequest {
  return new NextRequest(`http://test.local/api/deals/${DEAL_ID}/purchase`, {
    method: 'POST',
  });
}

const ctx = { params: Promise.resolve({ id: DEAL_ID }) };
const load = () => import('@/app/api/deals/[id]/purchase/route');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.generateRedemptionCode.mockReturnValue('DEAL-QR');
});

describe('POST /api/deals/[id]/purchase', () => {
  it('rejects purchases before a deal start time', async () => {
    const db = createMockClient({
      tables: {
        deals: {
          data: {
            id: DEAL_ID,
            place_id: PLACE_ID,
            kind: 'single_use',
            pack_size: 1,
            price_cents: 500,
            currency: 'EUR',
            active: true,
            starts_at: '2999-01-01T00:00:00.000Z',
            ends_at: null,
            purchase_limit_per_user: null,
          },
          error: null,
        },
      },
    });
    const admin = createMockClient();
    mocks.getRequestActor.mockResolvedValue(actorOf(db, USER));
    mocks.createAdminClient.mockReturnValue(admin);

    const { POST } = await load();
    const res = await POST(post(), ctx);

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'deal not started' });
    expect(callsFor(admin, 'deal_purchases', 'insert')).toHaveLength(0);
  });
});
