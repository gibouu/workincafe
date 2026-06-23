import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { callsFor, createMockClient, type MockClient } from './helpers/mock-supabase';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  constructEvent: vi.fn(),
}));

vi.mock('@/lib/payments/env', () => ({
  isStripeEnabled: () => true,
  stripeWebhookSecret: () => 'whsec_test',
}));

vi.mock('@/lib/payments/stripe', () => ({
  constructEvent: mocks.constructEvent,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}));

function post(): NextRequest {
  return new NextRequest('http://test.local/api/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': 'valid-signature' },
    body: '{}',
  });
}

function paymentSucceededEvent(id = 'evt_paid_1') {
  return {
    id,
    type: 'payment_intent.succeeded',
    livemode: false,
    data: { object: { id: 'pi_123' } },
  };
}

const load = () => import('@/app/api/stripe/webhook/route');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.constructEvent.mockReturnValue(paymentSucceededEvent());
});

describe('POST /api/stripe/webhook', () => {
  it('returns 500 and records a retryable failed event when a handler update fails', async () => {
    const admin = createMockClient({
      tables: {
        stripe_events: [
          { data: null, error: null },
          { data: null, error: null },
        ],
        deal_purchases: {
          data: null,
          error: { message: 'database unavailable' },
        },
      },
    });
    mocks.createAdminClient.mockReturnValue(admin);

    const { POST } = await load();
    const res = await POST(post());

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: 'mark purchase paid: database unavailable',
    });
    expect(callsFor(admin as MockClient, 'deal_purchases', 'update')).toHaveLength(1);
    expect(callsFor(admin as MockClient, 'stripe_events', 'upsert')[0]?.args[0]).toMatchObject({
      event_id: 'evt_paid_1',
      error: 'mark purchase paid: database unavailable',
    });
  });

  it('retries an event id that previously recorded an error', async () => {
    const admin = createMockClient({
      tables: {
        stripe_events: [
          { data: { event_id: 'evt_paid_1', error: 'previous failure' }, error: null },
          { data: null, error: null },
        ],
        deal_purchases: {
          data: null,
          error: null,
        },
      },
    });
    mocks.createAdminClient.mockReturnValue(admin);

    const { POST } = await load();
    const res = await POST(post());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(callsFor(admin as MockClient, 'deal_purchases', 'update')).toHaveLength(1);
    expect(callsFor(admin as MockClient, 'stripe_events', 'upsert')[0]?.args[0]).toMatchObject({
      event_id: 'evt_paid_1',
      error: null,
    });
  });

  it('skips only previously successful duplicate events', async () => {
    const admin = createMockClient({
      tables: {
        stripe_events: {
          data: { event_id: 'evt_paid_1', error: null },
          error: null,
        },
      },
    });
    mocks.createAdminClient.mockReturnValue(admin);

    const { POST } = await load();
    const res = await POST(post());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, duplicate: true });
    expect(callsFor(admin as MockClient, 'deal_purchases', 'update')).toHaveLength(0);
    expect(callsFor(admin as MockClient, 'stripe_events', 'upsert')).toHaveLength(0);
  });
});
