/**
 * Bulk moderation endpoints (#183): batch cap, empty/malformed ids,
 * decision validation (incl. `ban` rejected in bulk), dedup, and the
 * processed-vs-skipped accounting. Decision helpers are mocked — their
 * own behavior is covered in decide-helpers.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createMockClient, actorOf } from './helpers/mock-supabase';

const mocks = vi.hoisted(() => ({
  getRequestActor: vi.fn(),
  applyPlaceRequestDecision: vi.fn(),
  applyFlaggedReviewDecision: vi.fn(),
}));

vi.mock('@/lib/auth/request-actor', () => ({ getRequestActor: mocks.getRequestActor }));
vi.mock('@/lib/auth/admin-allowlist', () => ({
  isEmailAllowlisted: () => true,
  adminAllowlistEnabled: () => true,
}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn(() => ({})) }));
vi.mock('@/lib/admin/decide-place-request', () => ({
  applyPlaceRequestDecision: mocks.applyPlaceRequestDecision,
}));
vi.mock('@/lib/admin/decide-flagged-review', () => ({
  applyFlaggedReviewDecision: mocks.applyFlaggedReviewDecision,
}));

const USER = { id: '00000000-0000-0000-0000-0000000000aa', email: 'admin@example.com' };

function post(body: unknown): NextRequest {
  return new NextRequest('http://test.local/api/admin/x/bulk', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function authorize() {
  const db = createMockClient({ tables: { users: { data: { is_admin: true }, error: null } } });
  mocks.getRequestActor.mockResolvedValue(actorOf(db, USER));
}

beforeEach(() => {
  vi.clearAllMocks();
  authorize();
});

describe('POST /api/admin/place-requests/bulk', () => {
  const load = () => import('@/app/api/admin/place-requests/bulk/route');

  it('400 on invalid decision', async () => {
    const { POST } = await load();
    const res = await POST(post({ ids: ['a'], decision: 'banish' }));
    expect(res.status).toBe(400);
  });

  it('400 on empty ids', async () => {
    const { POST } = await load();
    const res = await POST(post({ ids: [], decision: 'approved' }));
    expect(res.status).toBe(400);
  });

  it('400 when ids is not an array', async () => {
    const { POST } = await load();
    const res = await POST(post({ ids: 'a,b,c', decision: 'approved' }));
    expect(res.status).toBe(400);
  });

  it('400 when over the 50-id cap', async () => {
    const { POST } = await load();
    const ids = Array.from({ length: 51 }, (_, i) => `id-${i}`);
    const res = await POST(post({ ids, decision: 'approved' }));
    expect(res.status).toBe(400);
    expect(mocks.applyPlaceRequestDecision).not.toHaveBeenCalled();
  });

  it('dedupes ids and drops non-strings before processing', async () => {
    mocks.applyPlaceRequestDecision.mockResolvedValue({ ok: true });
    const { POST } = await load();
    const res = await POST(post({ ids: ['a', 'a', 'b', 7, ''], decision: 'approved' }));
    expect(res.status).toBe(200);
    expect(mocks.applyPlaceRequestDecision).toHaveBeenCalledTimes(2);
    const body = await res.json();
    expect(body.processed).toEqual(['a', 'b']);
  });

  it('accounts processed vs skipped per id', async () => {
    mocks.applyPlaceRequestDecision
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, status: 409, error: 'request already decided' });
    const { POST } = await load();
    const res = await POST(post({ ids: ['a', 'b'], decision: 'rejected', rejection_reason: 'x' }));
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      decision: 'rejected',
      processed: ['a'],
      skipped: [{ id: 'b', reason: 'request already decided' }],
      processedCount: 1,
      skippedCount: 1,
    });
  });

  it('skips a thrown per-item decision and continues processing later ids', async () => {
    mocks.applyPlaceRequestDecision
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error('reverse geocode unavailable'))
      .mockResolvedValueOnce({ ok: true });

    const { POST } = await load();
    const res = await POST(post({ ids: ['a', 'b', 'c'], decision: 'approved' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mocks.applyPlaceRequestDecision).toHaveBeenCalledTimes(3);
    expect(body).toMatchObject({
      ok: true,
      decision: 'approved',
      processed: ['a', 'c'],
      skipped: [{ id: 'b', reason: 'reverse geocode unavailable' }],
      processedCount: 2,
      skippedCount: 1,
    });
  });
});

describe('POST /api/admin/flagged-reviews/bulk', () => {
  const load = () => import('@/app/api/admin/flagged-reviews/bulk/route');

  it("400 on decision 'ban' — ban is not bulk-able", async () => {
    const { POST } = await load();
    const res = await POST(post({ ids: ['a'], decision: 'ban' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/ban is not bulk-able/);
    expect(mocks.applyFlaggedReviewDecision).not.toHaveBeenCalled();
  });

  it('400 on empty ids', async () => {
    const { POST } = await load();
    const res = await POST(post({ ids: [], decision: 'dismiss' }));
    expect(res.status).toBe(400);
  });

  it('400 when over the 50-id cap', async () => {
    const { POST } = await load();
    const ids = Array.from({ length: 51 }, (_, i) => `id-${i}`);
    const res = await POST(post({ ids, decision: 'hide' }));
    expect(res.status).toBe(400);
  });

  it('processes dismiss/hide and reports skips', async () => {
    mocks.applyFlaggedReviewDecision
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, status: 404, error: 'flag not found' });
    const { POST } = await load();
    const res = await POST(post({ ids: ['f1', 'f2'], decision: 'hide', reason: 'spam' }));
    const body = await res.json();
    expect(body.processedCount).toBe(1);
    expect(body.skipped).toEqual([{ id: 'f2', reason: 'flag not found' }]);
    expect(mocks.applyFlaggedReviewDecision).toHaveBeenCalledWith(
      expect.anything(),
      'f1',
      'hide',
      'spam',
      USER.id,
    );
  });
});
