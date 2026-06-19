import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { callsFor, createMockClient } from './helpers/mock-supabase';

const mocks = vi.hoisted(() => ({
  getRequestActor: vi.fn(),
  loyaltyProgressFor: vi.fn(),
  pickFreebiePlace: vi.fn(),
  generateRedemptionCode: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/auth/request-actor', () => ({
  getRequestActor: mocks.getRequestActor,
}));

vi.mock('@/lib/loyalty/points', () => ({
  FREEBIE_POINT_COST: 20,
  loyaltyProgressFor: mocks.loyaltyProgressFor,
}));

vi.mock('@/lib/loyalty/freebie', () => ({
  pickFreebiePlace: mocks.pickFreebiePlace,
}));

vi.mock('@/lib/loyalty/qr', () => ({
  generateRedemptionCode: mocks.generateRedemptionCode,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}));

const user = {
  id: '00000000-0000-0000-0000-000000000217',
  email: 'user@example.com',
};

function post(): NextRequest {
  return new NextRequest('http://test.local/api/loyalty/claim-freebie', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ near: { lat: 48.85, lng: 2.35 } }),
  });
}

const load = () => import('@/app/api/loyalty/claim-freebie/route');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loyaltyProgressFor.mockResolvedValue({
    balance: 20,
    distinct_places: 5,
    freebie_unlocked: true,
    points_to_unlock: 0,
    places_to_unlock: 0,
  });
  mocks.pickFreebiePlace.mockResolvedValue({
    id: '00000000-0000-0000-0000-000000000999',
    name: 'Atomic Cafe',
  });
  mocks.generateRedemptionCode.mockReturnValue('FREEBIE-QR');
});

describe('POST /api/loyalty/claim-freebie', () => {
  it('uses the atomic claim_freebie_purchase RPC for ticket issuance and point spend', async () => {
    const db = createMockClient();
    const admin = createMockClient();
    admin.rpc.mockResolvedValue({
      data: [{ id: 'purchase-1', qr_code: 'FREEBIE-QR' }],
      error: null,
    });
    mocks.getRequestActor.mockResolvedValue({ db, user, isDemo: false });
    mocks.createAdminClient.mockReturnValue(admin);

    const { POST } = await load();
    const res = await POST(post());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      place: { id: '00000000-0000-0000-0000-000000000999', name: 'Atomic Cafe' },
      qr_code: 'FREEBIE-QR',
      points_spent: 20,
    });
    expect(admin.rpc).toHaveBeenCalledWith('claim_freebie_purchase', {
      p_user_id: user.id,
      p_place_id: '00000000-0000-0000-0000-000000000999',
      p_qr_code: 'FREEBIE-QR',
      p_is_demo: false,
    });
    expect(callsFor(admin, 'deal_purchases', 'insert')).toHaveLength(0);
    expect(callsFor(admin, 'point_events', 'insert')).toHaveLength(0);
  });

  it('returns a conflict when the RPC rejects a stale unlocked balance', async () => {
    const db = createMockClient();
    const admin = createMockClient();
    admin.rpc.mockResolvedValue({
      data: null,
      error: { message: 'freebie not unlocked' },
    });
    mocks.getRequestActor.mockResolvedValue({ db, user, isDemo: false });
    mocks.createAdminClient.mockReturnValue(admin);

    const { POST } = await load();
    const res = await POST(post());

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'freebie not unlocked' });
  });
});
