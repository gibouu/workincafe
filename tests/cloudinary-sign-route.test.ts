import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { actorOf, createMockClient } from './helpers/mock-supabase';

const mocks = vi.hoisted(() => ({
  getRequestActor: vi.fn(),
  isOwnerOf: vi.fn(),
  signCloudinaryUpload: vi.fn(async () => 'test-signature'),
}));

vi.mock('@/lib/auth/request-actor', () => ({
  getRequestActor: mocks.getRequestActor,
  isOwnerOf: mocks.isOwnerOf,
}));

vi.mock('@/lib/cloudinary', () => ({
  CLOUDINARY_CLOUD_NAME: 'test-cloud',
  signCloudinaryUpload: mocks.signCloudinaryUpload,
}));

const USER = { id: '00000000-0000-0000-0000-000000000001', email: 'u@example.com' };
const OTHER_USER_ID = '00000000-0000-0000-0000-000000000002';
const REVIEW_ID = '00000000-0000-0000-0000-000000000224';
const PLACE_ID = '00000000-0000-0000-0000-000000000225';

function post(body: unknown): NextRequest {
  return new NextRequest('http://test.local/api/cloudinary/sign', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const load = () => import('@/app/api/cloudinary/sign/route');

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CLOUDINARY_API_KEY = 'test-key';
  process.env.CLOUDINARY_API_SECRET = 'test-secret';
});

describe('POST /api/cloudinary/sign', () => {
  it('refuses review-photo signatures for reviews owned by another user', async () => {
    const db = createMockClient({
      tables: {
        reviews: { data: { user_id: OTHER_USER_ID }, error: null },
      },
    });
    mocks.getRequestActor.mockResolvedValue(actorOf(db, USER));

    const { POST } = await load();
    const res = await POST(post({ folder: `reviews/${REVIEW_ID}`, public_id: 'menu' }));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'not allowed to upload to this review' });
    expect(mocks.signCloudinaryUpload).not.toHaveBeenCalled();
  });

  it('refuses owner-menu signatures for places the user does not own', async () => {
    const db = createMockClient();
    mocks.getRequestActor.mockResolvedValue(actorOf(db, USER));
    mocks.isOwnerOf.mockResolvedValue(false);

    const { POST } = await load();
    const res = await POST(post({ folder: `owner-menus/${PLACE_ID}`, public_id: 'menu' }));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'not an owner of this place' });
    expect(mocks.isOwnerOf).toHaveBeenCalledWith(db, PLACE_ID, USER.id);
    expect(mocks.signCloudinaryUpload).not.toHaveBeenCalled();
  });

  it('mints a unique public id and signs non-overwrite uploads for authorized reviews', async () => {
    const db = createMockClient({
      tables: {
        reviews: { data: { user_id: USER.id }, error: null },
      },
    });
    mocks.getRequestActor.mockResolvedValue(actorOf(db, USER));

    const { POST } = await load();
    const res = await POST(post({ folder: `reviews/${REVIEW_ID}`, public_id: 'menu' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.public_id).toMatch(/^upload-[a-f0-9]{32}$/);
    expect(body.public_id).not.toBe('menu');
    expect(body.overwrite).toBe(false);
    expect(mocks.signCloudinaryUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: `reviews/${REVIEW_ID}`,
        public_id: body.public_id,
        overwrite: 'false',
      }),
      expect.any(String),
    );
  });
});
