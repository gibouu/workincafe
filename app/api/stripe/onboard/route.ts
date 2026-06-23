import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';
import { isStripeEnabled } from '@/lib/payments/env';
import {
  createConnectAccount,
  createOnboardingLink,
  getAccountSummary,
} from '@/lib/payments/stripe';
import { createAdminClient } from '@/lib/supabase/admin';

interface Body {
  country?: string;
  return_path?: string;
}

export async function POST(request: NextRequest) {
  const { user } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isStripeEnabled()) {
    return NextResponse.json(
      { error: 'STRIPE_SECRET_KEY not set — onboarding is disabled in this environment' },
      { status: 503 },
    );
  }
  if (!user.email) {
    return NextResponse.json({ error: 'an email on file is required' }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const country = body?.country?.toUpperCase() ?? 'FR';
  const returnPath = body?.return_path ?? '/owner';

  const admin = createAdminClient();

  // Reuse existing account if any
  const { data: existing } = await admin
    .from('stripe_accounts')
    .select('stripe_account_id')
    .eq('user_id', user.id)
    .maybeSingle();

  let accountId: string;
  if (existing?.stripe_account_id) {
    accountId = existing.stripe_account_id;
  } else {
    const account = await createConnectAccount({
      email: user.email,
      country,
      idempotencyKey: `stripe-connect-account:${user.id}`,
    });
    accountId = account.account_id;
    const { error: persistErr } = await admin.from('stripe_accounts').upsert(
      {
        user_id: user.id,
        stripe_account_id: accountId,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        country: account.country,
        default_currency: account.default_currency,
      },
      { onConflict: 'user_id' },
    );
    if (persistErr) {
      return NextResponse.json(
        { error: persistErr.message ?? 'stripe account persistence failed' },
        { status: 500 },
      );
    }
  }

  const url = await createOnboardingLink({
    account_id: accountId,
    return_path: returnPath,
    refresh_path: '/api/stripe/refresh',
  });
  return NextResponse.json({ url });
}

export async function GET(request: NextRequest) {
  // Cheap status read: returns the cached row + a fresh Stripe summary.
  const { user } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('stripe_accounts')
    .select('stripe_account_id, charges_enabled, payouts_enabled, details_submitted, country')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!row) return NextResponse.json({ enabled: false, account: null });

  if (!isStripeEnabled()) {
    return NextResponse.json({ enabled: true, fresh: false, account: row });
  }

  try {
    const fresh = await getAccountSummary(row.stripe_account_id);
    if (
      fresh.charges_enabled !== row.charges_enabled ||
      fresh.payouts_enabled !== row.payouts_enabled ||
      fresh.details_submitted !== row.details_submitted
    ) {
      await admin
        .from('stripe_accounts')
        .update({
          charges_enabled: fresh.charges_enabled,
          payouts_enabled: fresh.payouts_enabled,
          details_submitted: fresh.details_submitted,
        })
        .eq('user_id', user.id);
    }
    return NextResponse.json({ enabled: true, fresh: true, account: fresh });
  } catch {
    return NextResponse.json({ enabled: true, fresh: false, account: row });
  }
}
