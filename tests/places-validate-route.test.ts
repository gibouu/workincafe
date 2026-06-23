import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { callsFor, createMockClient } from './helpers/mock-supabase';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

const PLACE_ID = '00000000-0000-0000-0000-000000000123';
const USER_ID = '00000000-0000-0000-0000-000000000abc';

function request(): NextRequest {
  return new NextRequest(`http://test.local/api/places/${PLACE_ID}/validate`, {
    method: 'POST',
  });
}

const load = () => import('@/app/api/places/[id]/validate/route');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/places/[id]/validate', () => {
  it('only writes validation fields while the place is still unvalidated', async () => {
    const db = createMockClient({
      tables: {
        places: [
          { data: { id: PLACE_ID, user_validated_at: null }, error: null },
          { data: null, error: null },
        ],
      },
    });
    Object.assign(db.auth, {
      getUser: vi.fn(async () => ({ data: { user: { id: USER_ID } }, error: null })),
    });
    mocks.createClient.mockResolvedValue(db);

    const { POST } = await load();
    const res = await POST(request(), { params: Promise.resolve({ id: PLACE_ID }) });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(callsFor(db, 'places', 'update')).toHaveLength(1);
    expect(callsFor(db, 'places', 'is').map((call) => call.args)).toContainEqual([
      'user_validated_at',
      null,
    ]);
  });
});
