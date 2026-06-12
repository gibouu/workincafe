/**
 * GET /api/places/[id]/reviews (#183): user vs imported source filter,
 * limit clamping, and the demo-mode missing-table contract.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createMockClient, callsFor, type MockClient } from './helpers/mock-supabase';

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));

const PLACE_ID = '11111111-2222-3333-4444-555555555555';
const CTX = { params: Promise.resolve({ id: PLACE_ID }) };

const reviewRow = {
  id: 'rev-1',
  overall_rating: 8,
  wifi_rating: null,
  noise_rating: null,
  seating_rating: null,
  comment: 'quiet',
  geo_verified: true,
  created_at: '2026-06-01T00:00:00Z',
  source: 'user',
  users: { display_name: 'gib' },
  review_photos: [],
};

function get(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

function withClient(tables: ConstructorParameters<typeof Object>[0]): MockClient {
  const client = createMockClient({ tables: tables as never });
  mocks.createClient.mockResolvedValue(client);
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/places/[id]/reviews', () => {
  it('default: filters to genuine user reviews only', async () => {
    const client = withClient({ reviews: { data: [reviewRow], error: null } });
    const { GET } = await import('@/app/api/places/[id]/reviews/route');
    const res = await GET(get('http://test.local/api/places/x/reviews'), CTX);
    expect(res.status).toBe(200);
    expect((await res.json()).reviews).toHaveLength(1);
    const eqCalls = callsFor(client, 'reviews', 'eq').map((c) => c.args);
    expect(eqCalls).toContainEqual(['source', 'user']);
    expect(callsFor(client, 'reviews', 'neq')).toHaveLength(0);
  });

  it('?source=imported: excludes user reviews instead', async () => {
    const client = withClient({ reviews: { data: [], error: null } });
    const { GET } = await import('@/app/api/places/[id]/reviews/route');
    await GET(get('http://test.local/api/places/x/reviews?source=imported'), CTX);
    const neqCalls = callsFor(client, 'reviews', 'neq').map((c) => c.args);
    expect(neqCalls).toContainEqual(['source', 'user']);
    const eqCalls = callsFor(client, 'reviews', 'eq').map((c) => c.args);
    expect(eqCalls).not.toContainEqual(['source', 'user']);
  });

  it('clamps limit to 50', async () => {
    const client = withClient({ reviews: { data: [], error: null } });
    const { GET } = await import('@/app/api/places/[id]/reviews/route');
    await GET(get('http://test.local/api/places/x/reviews?limit=999'), CTX);
    const [limitCall] = callsFor(client, 'reviews', 'limit');
    expect(limitCall.args).toEqual([50]);
  });

  it('demo-mode contract: missing table (42P01) → empty list, not an error', async () => {
    withClient({ reviews: { data: null, error: { code: '42P01', message: 'missing' } } });
    const { GET } = await import('@/app/api/places/[id]/reviews/route');
    const res = await GET(get('http://test.local/api/places/x/reviews'), CTX);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reviews: [] });
  });

  it('resolves non-UUID demo ids through place_source_refs', async () => {
    const client = withClient({
      place_source_refs: { data: { place_id: PLACE_ID }, error: null },
      reviews: { data: [], error: null },
    });
    const { GET } = await import('@/app/api/places/[id]/reviews/route');
    const demoCtx = { params: Promise.resolve({ id: 'demo-cafe-1' }) };
    await GET(get('http://test.local/api/places/demo-cafe-1/reviews'), demoCtx);
    const refEq = callsFor(client, 'place_source_refs', 'eq').map((c) => c.args);
    expect(refEq).toContainEqual(['normalized_name_hash', 'demo:demo-cafe-1']);
    const placeEq = callsFor(client, 'reviews', 'eq').map((c) => c.args);
    expect(placeEq).toContainEqual(['place_id', PLACE_ID]);
  });
});
