/**
 * lib/admin decision helpers (#183) — real implementations against a
 * mocked admin client: happy paths with side-effect assertions, plus the
 * 404 / 409 / 410 contracts shared by the single and bulk routes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { applyPlaceRequestDecision } from '@/lib/admin/decide-place-request';
import { applyFlaggedReviewDecision } from '@/lib/admin/decide-flagged-review';
import { createMockClient, callsFor, type MockClient } from './helpers/mock-supabase';

type AdminClient = Parameters<typeof applyPlaceRequestDecision>[0];
const asAdmin = (c: MockClient) => c as unknown as AdminClient;

const REVIEWER = '00000000-0000-0000-0000-0000000000aa';
const REQ_ID = '00000000-0000-0000-0000-000000000001';

const pendingRequest = (over: Record<string, unknown> = {}) => ({
  id: REQ_ID,
  name: 'Café Test',
  lat: 48.85, // inside the Paris seed bbox
  lng: 2.35,
  address: '1 Rue du Test',
  category_suggestion: 'cafe',
  notes: null,
  status: 'pending',
  ...over,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('applyPlaceRequestDecision', () => {
  it('404 when the request row is missing', async () => {
    const admin = createMockClient({ tables: { place_requests: { data: null, error: null } } });
    const r = await applyPlaceRequestDecision(asAdmin(admin), REQ_ID, 'approved', undefined, REVIEWER);
    expect(r).toEqual({ ok: false, status: 404, error: 'request not found' });
  });

  it('409 when the request is already decided', async () => {
    const admin = createMockClient({
      tables: { place_requests: { data: pendingRequest({ status: 'approved' }), error: null } },
    });
    const r = await applyPlaceRequestDecision(asAdmin(admin), REQ_ID, 'rejected', undefined, REVIEWER);
    expect(r).toEqual({ ok: false, status: 409, error: 'request already decided' });
  });

  it('approve inside a seed bbox: calls the atomic approval RPC with resolved city/country', async () => {
    const admin = createMockClient({
      tables: {
        place_requests: { data: pendingRequest(), error: null },
      },
    });
    const r = await applyPlaceRequestDecision(asAdmin(admin), REQ_ID, 'approved', undefined, REVIEWER);
    expect(r).toEqual({ ok: true });

    expect(callsFor(admin, 'places', 'insert')).toHaveLength(0);
    expect(admin.rpc).toHaveBeenCalledWith('approve_place_request', {
      p_request_id: REQ_ID,
      p_reviewer_id: REVIEWER,
      p_city: 'Paris',
      p_country: 'FR',
    });
  });

  it('approve outside all seed bboxes: falls back to Photon reverse geocode', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          features: [{ properties: { countrycode: 'us', city: 'Miami' } }],
        }),
      })),
    );
    const admin = createMockClient({
      tables: {
        place_requests: { data: pendingRequest({ lat: 25.77, lng: -80.19 }), error: null },
      },
    });
    const r = await applyPlaceRequestDecision(asAdmin(admin), REQ_ID, 'approved', undefined, REVIEWER);
    expect(r).toEqual({ ok: true });
    expect(admin.rpc).toHaveBeenCalledWith('approve_place_request', expect.objectContaining({
      p_city: 'Miami',
      p_country: 'US',
    }));
  });

  it('reject: no place insert, trimmed rejection_reason stored', async () => {
    const admin = createMockClient({
      tables: {
        place_requests: [
          { data: pendingRequest(), error: null },
          { data: { id: REQ_ID }, error: null },
        ],
      },
    });
    const r = await applyPlaceRequestDecision(asAdmin(admin), REQ_ID, 'rejected', '  too vague  ', REVIEWER);
    expect(r).toEqual({ ok: true });
    expect(callsFor(admin, 'places', 'insert')).toHaveLength(0);
    const [update] = callsFor(admin, 'place_requests', 'update');
    expect(update.args[0]).toMatchObject({ status: 'rejected', rejection_reason: 'too vague' });
    expect(callsFor(admin, 'place_requests', 'eq').map((c) => c.args)).toContainEqual(['status', 'pending']);
  });

  it('approve returns 409 when the atomic RPC reports a concurrent decision', async () => {
    const admin = createMockClient({
      tables: {
        place_requests: { data: pendingRequest(), error: null },
      },
    });
    admin.rpc.mockResolvedValue({
      data: null,
      error: { message: 'request already decided' },
    });

    const r = await applyPlaceRequestDecision(asAdmin(admin), REQ_ID, 'approved', undefined, REVIEWER);

    expect(r).toEqual({ ok: false, status: 409, error: 'request already decided' });
    expect(callsFor(admin, 'places', 'insert')).toHaveLength(0);
  });

  it('reject returns 409 when a concurrent admin already claimed the request', async () => {
    const admin = createMockClient({
      tables: {
        place_requests: [
          { data: pendingRequest(), error: null },
          { data: null, error: null },
        ],
      },
    });

    const r = await applyPlaceRequestDecision(asAdmin(admin), REQ_ID, 'rejected', undefined, REVIEWER);

    expect(r).toEqual({ ok: false, status: 409, error: 'request already decided' });
  });
});

describe('applyFlaggedReviewDecision', () => {
  const FLAG_ID = '00000000-0000-0000-0000-000000000002';

  let admin: MockClient;
  beforeEach(() => {
    admin = createMockClient();
  });

  it('delegates a dismiss decision to the atomic RPC', async () => {
    const r = await applyFlaggedReviewDecision(asAdmin(admin), FLAG_ID, 'dismiss', undefined, REVIEWER);
    expect(r).toEqual({ ok: true });
    expect(admin.rpc).toHaveBeenCalledWith('decide_flagged_review', {
      p_flag_id: FLAG_ID,
      p_decision: 'dismiss',
      p_reason: null,
      p_reviewer_id: REVIEWER,
    });
    expect(callsFor(admin, 'flagged_reviews', 'update')).toHaveLength(0);
    expect(callsFor(admin, 'reviews', 'update')).toHaveLength(0);
    expect(callsFor(admin, 'users', 'update')).toHaveLength(0);
  });

  it('delegates hide with a trimmed reason to the atomic RPC', async () => {
    const r = await applyFlaggedReviewDecision(asAdmin(admin), FLAG_ID, 'hide', ' spam ', REVIEWER);
    expect(r).toEqual({ ok: true });
    expect(admin.rpc).toHaveBeenCalledWith('decide_flagged_review', {
      p_flag_id: FLAG_ID,
      p_decision: 'hide',
      p_reason: 'spam',
      p_reviewer_id: REVIEWER,
    });
  });

  it('delegates ban to the atomic RPC', async () => {
    const r = await applyFlaggedReviewDecision(asAdmin(admin), FLAG_ID, 'ban', undefined, REVIEWER);
    expect(r).toEqual({ ok: true });
    expect(admin.rpc).toHaveBeenCalledWith('decide_flagged_review', {
      p_flag_id: FLAG_ID,
      p_decision: 'ban',
      p_reason: null,
      p_reviewer_id: REVIEWER,
    });
  });

  it('maps RPC missing, already-decided, and orphan-review errors to route statuses', async () => {
    const cases = [
      ['flag not found', 404, 'flag not found'],
      ['flag already decided', 409, 'flag already decided'],
      ['underlying review missing', 410, 'underlying review missing'],
      ['unexpected database failure', 500, 'unexpected database failure'],
    ] as const;

    for (const [message, status, error] of cases) {
      const client = createMockClient();
      client.rpc.mockResolvedValueOnce({ data: null, error: { message } });

      const r = await applyFlaggedReviewDecision(asAdmin(client), FLAG_ID, 'hide', undefined, REVIEWER);

      expect(r).toEqual({ ok: false, status, error });
    }
  });
});
