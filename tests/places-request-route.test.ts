/**
 * POST /api/places/request — add-a-place submissions enter the pending
 * queue. Client-supplied geolocation is not trusted as an authorization
 * signal for service-role instant publishing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createMockClient, actorOf, type MockClient } from './helpers/mock-supabase';

const mocks = vi.hoisted(() => ({
  getRequestActor: vi.fn(),
  insertWithDemoFlag: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/auth/request-actor', () => ({
  getRequestActor: mocks.getRequestActor,
  insertWithDemoFlag: mocks.insertWithDemoFlag,
}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }));

// Paris bbox coords: resolveCityCountry resolves from SEED_CITIES without
// any network call.
const PLACE = { name: 'Café Nouveau', lat: 48.85, lng: 2.35 };
const NEARBY = { verified_lat: 48.8501, verified_lng: 2.3501 }; // ~15m away
const FARAWAY = { verified_lat: 48.9, verified_lng: 2.45 }; // km away

let userSeq = 0;
function authorize(): MockClient {
  // Distinct user per test so the 10/hour rate limit never trips.
  const db = createMockClient();
  const user = { id: `00000000-0000-0000-0000-0000000000${String(20 + userSeq++)}`, email: 'u@example.com' };
  mocks.getRequestActor.mockResolvedValue(actorOf(db, user));
  return db;
}

function post(body: unknown): NextRequest {
  return new NextRequest('http://test.local/api/places/request', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const load = () => import('@/app/api/places/request/route');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/places/request', () => {
  it('401 when signed out', async () => {
    mocks.getRequestActor.mockResolvedValue(actorOf(createMockClient(), null));
    const { POST } = await load();
    const res = await POST(post({ ...PLACE }));
    expect(res.status).toBe(401);
  });

  it('400 when name/lat/lng missing', async () => {
    authorize();
    const { POST } = await load();
    const res = await POST(post({ name: 'No coords' }));
    expect(res.status).toBe(400);
  });

  it('client-supplied verified coordinates do not bypass the pending queue', async () => {
    authorize();
    mocks.insertWithDemoFlag.mockResolvedValue({ data: { id: 'req-client-geo' }, error: null });

    const { POST } = await load();
    const res = await POST(post({
      ...PLACE,
      verified_lat: PLACE.lat,
      verified_lng: PLACE.lng,
    }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ published: false, id: 'req-client-geo' });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it('nearby client-provided geolocation still enters the pending queue', async () => {
    authorize();
    mocks.insertWithDemoFlag.mockResolvedValue({ data: { id: 'req-nearby' }, error: null });

    const { POST } = await load();
    const res = await POST(post({ ...PLACE, category: 'cafe', ...NEARBY }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ published: false, id: 'req-nearby' });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it('still accepts duplicate-looking requests through the pending queue', async () => {
    authorize();
    mocks.insertWithDemoFlag.mockResolvedValue({ data: { id: 'req-duplicate' }, error: null });

    const { POST } = await load();
    const res = await POST(post({ ...PLACE, ...NEARBY }));
    expect(await res.json()).toEqual({ published: false, id: 'req-duplicate' });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it('too far from the place: falls back to the pending queue', async () => {
    authorize();
    mocks.insertWithDemoFlag.mockResolvedValue({ data: { id: 'req-1' }, error: null });
    const { POST } = await load();
    const res = await POST(post({ ...PLACE, ...FARAWAY }));
    expect(await res.json()).toEqual({ published: false, id: 'req-1' });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it('no geolocation at all: falls back to the pending queue', async () => {
    authorize();
    mocks.insertWithDemoFlag.mockResolvedValue({ data: { id: 'req-2' }, error: null });
    const { POST } = await load();
    const res = await POST(post({ ...PLACE }));
    expect(await res.json()).toEqual({ published: false, id: 'req-2' });
  });

  it('pending queue insert failures are returned as server errors', async () => {
    authorize();
    mocks.insertWithDemoFlag.mockResolvedValue({ data: null, error: { message: 'insert denied' } });
    const { POST } = await load();
    const res = await POST(post({ ...PLACE, ...NEARBY }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'insert denied' });
  });
});
