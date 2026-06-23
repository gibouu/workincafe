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

const USER = { id: '00000000-0000-0000-0000-000000000227', email: 'u@example.com' };
const PLACE_ID = '00000000-0000-0000-0000-000000000052';

function post(body: unknown): NextRequest {
  return new NextRequest('http://test.local/api/decibel', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const load = () => import('@/app/api/decibel/route');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/decibel', () => {
  it('delegates live inserts and hourly limit enforcement to the atomic RPC', async () => {
    const db = createMockClient();
    db.rpc.mockResolvedValue({
      data: [{ id: 'decibel-1', inserted: true }],
      error: null,
    });
    mocks.getRequestActor.mockResolvedValue(actorOf(db, USER));
    mocks.insertWithDemoFlag.mockResolvedValue({ data: { id: 'legacy-insert' }, error: null });

    const { POST } = await load();
    const res = await POST(
      post({
        place_id: PLACE_ID,
        avg_db: 54.2,
        peak_db: 71.8,
        duration_seconds: 10,
        device_model: 'iPhone',
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'decibel-1' });
    expect(db.rpc).toHaveBeenCalledWith(
      'submit_decibel_sample_rate_limited',
      expect.objectContaining({
        p_place_id: PLACE_ID,
        p_avg_db: 54.2,
        p_peak_db: 71.8,
        p_duration_seconds: 10,
        p_device_model: 'iPhone',
      }),
    );
    expect(callsFor(db, 'decibel_samples', 'select')).toHaveLength(0);
    expect(mocks.insertWithDemoFlag).not.toHaveBeenCalled();
  });

  it('returns 429 when the atomic RPC reports the hourly limit is reached', async () => {
    const db = createMockClient();
    db.rpc.mockResolvedValue({
      data: [{ id: null, inserted: false }],
      error: null,
    });
    mocks.getRequestActor.mockResolvedValue(actorOf(db, USER));

    const { POST } = await load();
    const res = await POST(post({ place_id: PLACE_ID, avg_db: 54.2 }));

    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'three decibel tests per hour' });
    expect(mocks.insertWithDemoFlag).not.toHaveBeenCalled();
  });

  it('returns 503 when the decibel schema or RPC has not been migrated', async () => {
    const db = createMockClient();
    db.rpc.mockResolvedValue({
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function' },
    });
    mocks.getRequestActor.mockResolvedValue(actorOf(db, USER));

    const { POST } = await load();
    const res = await POST(post({ place_id: PLACE_ID, avg_db: 54.2 }));

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'table missing' });
    expect(mocks.insertWithDemoFlag).not.toHaveBeenCalled();
  });

  it('keeps demo submissions on the demo insert workflow', async () => {
    const db = createMockClient();
    mocks.getRequestActor.mockResolvedValue({
      db,
      supabase: db,
      user: { ...USER, name: null, isDemo: true },
      isDemo: true,
    });
    mocks.insertWithDemoFlag.mockResolvedValue({ data: { id: 'demo-decibel-1' }, error: null });

    const { POST } = await load();
    const res = await POST(post({ place_id: PLACE_ID, avg_db: 48 }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'demo-decibel-1' });
    expect(db.rpc).not.toHaveBeenCalled();
    expect(mocks.insertWithDemoFlag).toHaveBeenCalledWith(
      db,
      'decibel_samples',
      expect.objectContaining({
        place_id: PLACE_ID,
        user_id: USER.id,
        avg_db: 48,
      }),
      true,
    );
  });
});
