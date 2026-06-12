/**
 * POST /api/places/request — add-a-place v2 (#200): any-city submissions,
 * instant publish when the submitter is geo-verified at the place,
 * pending-queue fallback otherwise. Admin oversight is post-hoc.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createMockClient, callsFor, actorOf, type MockClient } from './helpers/mock-supabase';

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

  it('geo-verified at the place: publishes instantly with resolved city/country', async () => {
    authorize();
    const admin = createMockClient({
      tables: {
        places: { data: { id: 'place-1' }, error: null },
        place_requests: { data: { id: 'audit-1' }, error: null },
        place_source_refs: { data: null, error: null },
      },
    });
    mocks.createAdminClient.mockReturnValue(admin);

    const { POST } = await load();
    const res = await POST(post({ ...PLACE, category: 'cafe', ...NEARBY }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ published: true, placeId: 'place-1' });

    const [upsert] = callsFor(admin, 'places', 'upsert');
    expect(upsert.args[0]).toMatchObject({
      name: 'Café Nouveau',
      city: 'Paris',
      country: 'FR',
      category: 'cafe',
    });
    expect(upsert.args[1]).toMatchObject({ ignoreDuplicates: true });

    const [audit] = callsFor(admin, 'place_requests', 'insert');
    expect(audit.args[0]).toMatchObject({ status: 'approved', name: 'Café Nouveau' });

    const [ref] = callsFor(admin, 'place_source_refs', 'upsert');
    expect(ref.args[0]).toMatchObject({ place_id: 'place-1', source: 'user_submitted' });

    expect(mocks.insertWithDemoFlag).not.toHaveBeenCalled();
  });

  it('duplicate place: resolves the existing row instead of forking', async () => {
    authorize();
    const admin = createMockClient({
      tables: {
        places: [
          { data: null, error: null }, // upsert hit ignoreDuplicates → no row
          { data: { id: 'existing-9' }, error: null }, // select by hash
        ],
        place_requests: { data: { id: 'audit-2' }, error: null },
        place_source_refs: { data: null, error: null },
      },
    });
    mocks.createAdminClient.mockReturnValue(admin);

    const { POST } = await load();
    const res = await POST(post({ ...PLACE, ...NEARBY }));
    expect(await res.json()).toEqual({ published: true, placeId: 'existing-9' });
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

  it('instant path failure degrades to the pending queue, not an error', async () => {
    authorize();
    const admin = createMockClient({
      tables: { places: { data: null, error: { message: 'rls denied' } } },
    });
    mocks.createAdminClient.mockReturnValue(admin);
    mocks.insertWithDemoFlag.mockResolvedValue({ data: { id: 'req-3' }, error: null });
    const { POST } = await load();
    const res = await POST(post({ ...PLACE, ...NEARBY }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ published: false, id: 'req-3' });
  });
});
