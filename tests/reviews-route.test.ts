import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { actorOf, callsFor, createMockClient } from './helpers/mock-supabase';

const mocks = vi.hoisted(() => ({
  getRequestActor: vi.fn(),
  insertWithDemoFlag: vi.fn(),
  resolvePlaceIdForActor: vi.fn(async (_db: unknown, placeId: string) => placeId),
}));

vi.mock('@/lib/auth/request-actor', () => ({
  getRequestActor: mocks.getRequestActor,
  insertWithDemoFlag: mocks.insertWithDemoFlag,
  resolvePlaceIdForActor: mocks.resolvePlaceIdForActor,
}));

const USER = { id: '00000000-0000-0000-0000-000000000226', email: 'u@example.com' };
const PLACE_ID = '00000000-0000-0000-0000-000000000227';
const PLACE = { lat: 48.85, lng: 2.35 };

function post(body: unknown): NextRequest {
  return new NextRequest('http://test.local/api/reviews', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function authorize() {
  const db = createMockClient({
    tables: {
      places: { data: PLACE, error: null },
      reviews: { data: [], error: null },
    },
  });
  db.rpc.mockResolvedValue({ data: [{ id: 'review-1', inserted: true }], error: null });
  mocks.getRequestActor.mockResolvedValue(actorOf(db, USER));
  mocks.insertWithDemoFlag.mockResolvedValue({ data: { id: 'review-1' }, error: null });
  return db;
}

const load = () => import('@/app/api/reviews/route');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/reviews', () => {
  it('does not trust forged client coordinates as geo verification', async () => {
    const db = authorize();

    const { POST } = await load();
    const res = await POST(
      post({
        place_id: PLACE_ID,
        overall_rating: 8,
        verified_lat: PLACE.lat,
        verified_lng: PLACE.lng,
      }),
    );

    expect(res.status).toBe(200);
    const rpcPayload = db.rpc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(rpcPayload).not.toHaveProperty('p_geo_verified');
    expect(rpcPayload).not.toHaveProperty('p_verified_lat');
    expect(rpcPayload).not.toHaveProperty('p_verified_lng');
  });

  it('rejects review submissions without fresh coordinates', async () => {
    authorize();

    const { POST } = await load();
    const res = await POST(
      post({
        place_id: PLACE_ID,
        overall_rating: 7,
        comment: 'Good tables by the window',
      }),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'verified_lat/verified_lng required' });
    expect(mocks.insertWithDemoFlag).not.toHaveBeenCalled();
  });

  it('delegates live inserts and daily review limit enforcement to the atomic RPC', async () => {
    const db = authorize();
    db.rpc.mockResolvedValue({
      data: [{ id: 'review-atomic-1', inserted: true }],
      error: null,
    });

    const { POST } = await load();
    const res = await POST(
      post({
        place_id: PLACE_ID,
        overall_rating: 9,
        wifi_rating: 8,
        current_busyness: 3,
        comment: 'Quiet enough for focused work',
        verified_lat: PLACE.lat,
        verified_lng: PLACE.lng,
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'review-atomic-1' });
    expect(db.rpc).toHaveBeenCalledWith(
      'submit_review_rate_limited',
      expect.objectContaining({
        p_place_id: PLACE_ID,
        p_overall_rating: 9,
        p_wifi_rating: 8,
        p_current_busyness: 3,
        p_comment: 'Quiet enough for focused work',
      }),
    );
    expect(callsFor(db, 'reviews', 'select')).toHaveLength(0);
    expect(mocks.insertWithDemoFlag).not.toHaveBeenCalled();
  });
});
