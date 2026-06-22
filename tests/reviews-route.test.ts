import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { actorOf, createMockClient } from './helpers/mock-supabase';

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
    authorize();

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
    const inserted = mocks.insertWithDemoFlag.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(inserted).toMatchObject({
      geo_verified: false,
      verified_lat: null,
      verified_lng: null,
    });
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
});
