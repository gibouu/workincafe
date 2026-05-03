import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';
import { isStripeEnabled } from '@/lib/payments/env';
import { createOnboardingLink } from '@/lib/payments/stripe';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Stripe-hosted onboarding links expire (~5 min). When a user follows an
 * expired link, Stripe sends them here so we can mint a fresh one.
 */
export async function GET(request: NextRequest) {
  const { user } = await getRequestActor(request);
  if (!user) return NextResponse.redirect(new URL('/auth?next=/owner', request.url));
  if (!isStripeEnabled()) return NextResponse.redirect(new URL('/owner', request.url));

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('stripe_accounts')
    .select('stripe_account_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!row?.stripe_account_id) return NextResponse.redirect(new URL('/owner', request.url));

  try {
    const url = await createOnboardingLink({
      account_id: row.stripe_account_id,
      return_path: '/owner',
      refresh_path: '/api/stripe/refresh',
    });
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(new URL('/owner', request.url));
  }
}
