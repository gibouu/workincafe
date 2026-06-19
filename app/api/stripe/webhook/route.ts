import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { stripeWebhookSecret, isStripeEnabled } from '@/lib/payments/env';
import { constructEvent } from '@/lib/payments/stripe';
import { createAdminClient } from '@/lib/supabase/admin';

type SupabaseResult = { error?: { message?: string } | null };

function assertSupabaseOk(result: SupabaseResult, context: string) {
  if (!result.error) return;
  throw new Error(`${context}: ${result.error.message ?? 'Supabase mutation failed'}`);
}

/**
 * Webhook receiver. Server-only; verifies Stripe signature; deduplicates by
 * event.id; routes by event.type. Each handler is idempotent — Stripe
 * retries aggressively.
 *
 * Set STRIPE_WEBHOOK_SECRET in env. Locally, run `stripe listen --forward-to
 * http://localhost:3000/api/stripe/webhook` and copy the signing secret it
 * prints into .env.local.
 */
export async function POST(request: NextRequest) {
  if (!isStripeEnabled()) {
    return NextResponse.json({ error: 'stripe disabled' }, { status: 503 });
  }
  const secret = stripeWebhookSecret();
  if (!secret) {
    return NextResponse.json({ error: 'STRIPE_WEBHOOK_SECRET not set' }, { status: 503 });
  }

  const sig = request.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'missing signature' }, { status: 400 });

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = constructEvent(rawBody, sig, secret);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'invalid signature' },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Idempotency — if we've already processed this event id, skip.
  const { data: existing, error: existingError } = await admin
    .from('stripe_events')
    .select('event_id,error')
    .eq('event_id', event.id)
    .maybeSingle();
  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }
  if (existing && !(existing as { error?: string | null }).error) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  let handlerError: string | null = null;
  try {
    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        assertSupabaseOk(await admin
          .from('stripe_accounts')
          .update({
            charges_enabled: Boolean(account.charges_enabled),
            payouts_enabled: Boolean(account.payouts_enabled),
            details_submitted: Boolean(account.details_submitted),
          })
          .eq('stripe_account_id', account.id), 'update stripe account');
        break;
      }
      case 'checkout.session.completed':
      case 'payment_intent.succeeded': {
        // Purchase rows are written by /api/deals/[id]/purchase when the
        // Checkout Session redirects back; the webhook is a backstop. We
        // only flip payment_status on the matching row if it exists.
        const obj = event.data.object as { id?: string; payment_intent?: string | null };
        const paymentIntentId =
          (obj as { payment_intent?: string }).payment_intent ?? obj.id ?? null;
        if (paymentIntentId) {
          assertSupabaseOk(await admin
            .from('deal_purchases')
            .update({ payment_status: 'paid' })
            .eq('payment_intent_id', paymentIntentId), 'mark purchase paid');
        }
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const pi = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
        if (pi) {
          assertSupabaseOk(await admin
            .from('deal_purchases')
            .update({
              payment_status: 'refunded',
              refunded_at: new Date().toISOString(),
              refund_amount_cents: charge.amount_refunded,
            })
            .eq('payment_intent_id', pi), 'mark purchase refunded');
        }
        break;
      }
      case 'charge.dispute.created':
      case 'charge.dispute.closed': {
        const dispute = event.data.object as Stripe.Dispute;
        const pi = typeof dispute.payment_intent === 'string' ? dispute.payment_intent : null;
        if (pi) {
          assertSupabaseOk(await admin
            .from('deal_purchases')
            .update({ payment_status: 'disputed' })
            .eq('payment_intent_id', pi), 'mark purchase disputed');
        }
        break;
      }
      // Other events: just log for now.
      default:
        break;
    }
  } catch (err) {
    handlerError = err instanceof Error ? err.message : 'handler failed';
  }

  const recordResult = await admin.from('stripe_events').upsert({
    event_id: event.id,
    event_type: event.type,
    livemode: event.livemode,
    payload_summary: { id: event.id, type: event.type, livemode: event.livemode },
    processed_at: new Date().toISOString(),
    error: handlerError,
  }, { onConflict: 'event_id' });
  if (recordResult.error) {
    return NextResponse.json({ error: recordResult.error.message }, { status: 500 });
  }

  if (handlerError) {
    return NextResponse.json({ error: handlerError }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
