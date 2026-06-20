import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { callsFor, createMockClient, actorOf } from './helpers/mock-supabase';

const mocks = vi.hoisted(() => ({
  getRequestActor: vi.fn(),
}));

vi.mock('@/lib/auth/request-actor', () => ({
  getRequestActor: mocks.getRequestActor,
}));

const REVIEW_ID = '00000000-0000-0000-0000-000000000220';
const user = { id: '00000000-0000-0000-0000-000000000001', email: 'u@example.com' };

function post(body: unknown): NextRequest {
  return new NextRequest(`http://test.local/api/reviews/${REVIEW_ID}/photos`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const load = () => import('@/app/api/reviews/[id]/photos/route');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/reviews/[id]/photos', () => {
  it('includes the legacy path column when persisting Cloudinary photos', async () => {
    const db = createMockClient({
      tables: {
        review_photos: { data: null, error: null },
      },
    });
    mocks.getRequestActor.mockResolvedValue(actorOf(db, user));

    const { POST } = await load();
    const res = await POST(
      post({
        photos: [
          {
            slot: 'inside',
            cloudinary_public_id: `reviews/${REVIEW_ID}/inside`,
            cloudinary_version: '123',
            width: 100,
            height: 120,
            bytes: 1000,
          },
        ],
      }),
      { params: Promise.resolve({ id: REVIEW_ID }) },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, inserted: 1 });
    expect(callsFor(db, 'review_photos', 'upsert')[0]?.args[0]).toEqual([
      expect.objectContaining({
        review_id: REVIEW_ID,
        slot: 'inside',
        path: `reviews/${REVIEW_ID}/inside`,
        cloudinary_public_id: `reviews/${REVIEW_ID}/inside`,
      }),
    ]);
  });
});
