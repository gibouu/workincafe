import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createMockClient } from './helpers/mock-supabase';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  searchAssetsByFolder: vi.fn(),
  destroyAssets: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock('@/lib/cloudinary-admin', () => ({
  searchAssetsByFolder: mocks.searchAssetsByFolder,
  destroyAssets: mocks.destroyAssets,
}));

function cronRequest(headers: Record<string, string> = {}) {
  return new NextRequest('http://test.local/api/cron/prune-orphaned-cloudinary', {
    method: 'POST',
    headers,
  });
}

async function* pages(rows: { public_id: string; created_at: string }[][]) {
  for (const page of rows) yield page;
}

const load = () => import('@/app/api/cron/prune-orphaned-cloudinary/route');

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CRON_SECRET', 'cron-secret');
  vi.stubEnv('CLOUDINARY_API_KEY', 'key');
  vi.stubEnv('CLOUDINARY_API_SECRET', 'secret');
  vi.stubEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME', 'cloud');
  vi.setSystemTime(new Date('2026-06-23T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('POST /api/cron/prune-orphaned-cloudinary', () => {
  it('rejects unauthorized requests before searching or deleting assets', async () => {
    const { POST } = await load();
    const res = await POST(cronRequest());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
    expect(mocks.searchAssetsByFolder).not.toHaveBeenCalled();
    expect(mocks.destroyAssets).not.toHaveBeenCalled();
  });

  it('requires Cloudinary configuration before destructive scans', async () => {
    vi.stubEnv('CLOUDINARY_API_SECRET', '');

    const { POST } = await load();
    const res = await POST(cronRequest({ authorization: 'Bearer cron-secret' }));

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'cloudinary not configured' });
    expect(mocks.searchAssetsByFolder).not.toHaveBeenCalled();
    expect(mocks.destroyAssets).not.toHaveBeenCalled();
  });

  it('deletes only old assets missing from the backing tables', async () => {
    const admin = createMockClient({
      tables: {
        review_photos: {
          data: [{ cloudinary_public_id: 'reviews/live' }],
          error: null,
        },
        place_menus: {
          data: [],
          error: null,
        },
      },
    });
    mocks.createAdminClient.mockReturnValue(admin);
    mocks.searchAssetsByFolder.mockImplementation((folder: string) => {
      if (folder === 'reviews/') {
        return pages([
          [
            { public_id: 'reviews/live', created_at: '2026-06-21T12:00:00.000Z' },
            { public_id: 'reviews/orphan', created_at: '2026-06-21T12:00:00.000Z' },
            { public_id: 'reviews/new-upload', created_at: '2026-06-23T11:30:00.000Z' },
          ],
        ]);
      }
      return pages([[{ public_id: 'owner-menus/orphan', created_at: '2026-06-21T12:00:00.000Z' }]]);
    });
    mocks.destroyAssets.mockResolvedValue(1);

    const { POST } = await load();
    const res = await POST(cronRequest({ authorization: 'Bearer cron-secret' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      summary: [
        { folder: 'reviews', scanned: 3, candidates: 1, deleted: 1 },
        { folder: 'owner-menus', scanned: 1, candidates: 1, deleted: 1 },
      ],
    });
    expect(mocks.destroyAssets).toHaveBeenCalledWith(['reviews/orphan']);
    expect(mocks.destroyAssets).toHaveBeenCalledWith(['owner-menus/orphan']);
    expect(mocks.destroyAssets).not.toHaveBeenCalledWith(
      expect.arrayContaining(['reviews/live', 'reviews/new-upload']),
    );
  });
});
