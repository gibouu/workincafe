import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { actorOf, callsFor, createMockClient } from './helpers/mock-supabase';

const mocks = vi.hoisted(() => ({
  getRequestActor: vi.fn(),
  isStripeEnabled: vi.fn(() => true),
  createAdminClient: vi.fn(),
  createConnectAccount: vi.fn(),
  createOnboardingLink: vi.fn(),
}));

vi.mock('@/lib/auth/request-actor', () => ({ getRequestActor: mocks.getRequestActor }));
vi.mock('@/lib/payments/env', () => ({ isStripeEnabled: mocks.isStripeEnabled }));
vi.mock('@/lib/payments/stripe', () => ({
  createConnectAccount: mocks.createConnectAccount,
  createOnboardingLink: mocks.createOnboardingLink,
  getAccountSummary: vi.fn(),
}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }));

const USER = {
  id: '00000000-0000-0000-0000-000000000045',
  email: 'owner@example.com',
};

function post(body: unknown = {}): NextRequest {
  return new NextRequest('http://test.local/api/stripe/onboard', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isStripeEnabled.mockReturnValue(true);
  mocks.getRequestActor.mockResolvedValue(actorOf(createMockClient(), USER));
  mocks.createConnectAccount.mockResolvedValue({
    account_id: 'acct_new',
    charges_enabled: false,
    payouts_enabled: false,
    details_submitted: false,
    country: 'FR',
    default_currency: 'eur',
  });
  mocks.createOnboardingLink.mockResolvedValue('https://stripe.test/onboard');
});

describe('POST /api/stripe/onboard', () => {
  it('creates Connect accounts with a per-user idempotency key before persisting', async () => {
    const admin = createMockClient({
      tables: {
        stripe_accounts: [
          { data: null, error: null },
          { data: null, error: null },
        ],
      },
    });
    mocks.createAdminClient.mockReturnValue(admin);

    const { POST } = await import('@/app/api/stripe/onboard/route');
    const res = await POST(post({ country: 'fr', return_path: '/owner' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://stripe.test/onboard' });
    expect(mocks.createConnectAccount).toHaveBeenCalledWith({
      email: USER.email,
      country: 'FR',
      idempotencyKey: `stripe-connect-account:${USER.id}`,
    });
    expect(callsFor(admin, 'stripe_accounts', 'upsert')).toHaveLength(1);
    expect(mocks.createOnboardingLink).toHaveBeenCalledWith({
      account_id: 'acct_new',
      return_path: '/owner',
      refresh_path: '/api/stripe/refresh',
    });
  });

  it('does not create an onboarding link when account persistence fails', async () => {
    const admin = createMockClient({
      tables: {
        stripe_accounts: [
          { data: null, error: null },
          { data: null, error: { message: 'database unavailable' } },
        ],
      },
    });
    mocks.createAdminClient.mockReturnValue(admin);

    const { POST } = await import('@/app/api/stripe/onboard/route');
    const res = await POST(post());

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'database unavailable' });
    expect(mocks.createOnboardingLink).not.toHaveBeenCalled();
  });

  it('reuses an existing persisted account without creating a new Stripe account', async () => {
    const admin = createMockClient({
      tables: {
        stripe_accounts: { data: { stripe_account_id: 'acct_existing' }, error: null },
      },
    });
    mocks.createAdminClient.mockReturnValue(admin);

    const { POST } = await import('@/app/api/stripe/onboard/route');
    const res = await POST(post({ return_path: '/owner/places' }));

    expect(res.status).toBe(200);
    expect(mocks.createConnectAccount).not.toHaveBeenCalled();
    expect(mocks.createOnboardingLink).toHaveBeenCalledWith({
      account_id: 'acct_existing',
      return_path: '/owner/places',
      refresh_path: '/api/stripe/refresh',
    });
  });
});
