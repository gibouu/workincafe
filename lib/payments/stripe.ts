/**
 * Lazy-initialised Stripe client + Connect helpers. Server-only.
 * Throws on use when STRIPE_SECRET_KEY is missing — callers should gate via
 * isStripeEnabled() first.
 */

import Stripe from 'stripe';
import { stripeSecretKey, appUrl } from '@/lib/payments/env';

let cached: Stripe | null = null;

export function stripe(): Stripe {
  if (cached) return cached;
  const key = stripeSecretKey();
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  cached = new Stripe(key, {
    apiVersion: '2026-04-22.dahlia',
    appInfo: {
      name: 'Work in Cafe',
      version: '0.1.0',
      url: 'https://workin.cafe',
    },
  });
  return cached;
}

export interface ConnectAccountSummary {
  account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  country: string | null;
  default_currency: string | null;
}

export async function createConnectAccount(args: {
  email: string;
  country?: string; // ISO-2, e.g. 'FR' or 'CA'
  idempotencyKey?: string;
}): Promise<ConnectAccountSummary> {
  const account = await stripe().accounts.create(
    {
      type: 'express',
      email: args.email,
      country: args.country,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: { product_description: 'Work-spot deals via Work in Cafe' },
    },
    args.idempotencyKey ? { idempotencyKey: args.idempotencyKey } : undefined,
  );
  return summarize(account);
}

export async function createOnboardingLink(args: {
  account_id: string;
  return_path: string;
  refresh_path: string;
}): Promise<string> {
  const link = await stripe().accountLinks.create({
    account: args.account_id,
    return_url: `${appUrl()}${args.return_path}`,
    refresh_url: `${appUrl()}${args.refresh_path}`,
    type: 'account_onboarding',
  });
  return link.url;
}

export async function getAccountSummary(accountId: string): Promise<ConnectAccountSummary> {
  const account = await stripe().accounts.retrieve(accountId);
  return summarize(account);
}

export async function createCheckoutSession(args: {
  account_id: string;
  amount_cents: number;
  currency: string;
  application_fee_cents: number;
  product_name: string;
  metadata: Record<string, string>;
  return_path: string;
}): Promise<{ id: string; url: string }> {
  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: args.currency.toLowerCase(),
          product_data: { name: args.product_name },
          unit_amount: args.amount_cents,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      application_fee_amount: args.application_fee_cents,
      transfer_data: { destination: args.account_id },
      metadata: args.metadata,
    },
    metadata: args.metadata,
    success_url: `${appUrl()}${args.return_path}?stripe_session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}${args.return_path}?stripe_cancelled=1`,
  });
  return { id: session.id, url: session.url ?? '' };
}

export function constructEvent(
  rawBody: string,
  signatureHeader: string,
  webhookSecret: string,
): Stripe.Event {
  return stripe().webhooks.constructEvent(rawBody, signatureHeader, webhookSecret);
}

function summarize(a: Stripe.Account): ConnectAccountSummary {
  return {
    account_id: a.id,
    charges_enabled: Boolean(a.charges_enabled),
    payouts_enabled: Boolean(a.payouts_enabled),
    details_submitted: Boolean(a.details_submitted),
    country: a.country ?? null,
    default_currency: a.default_currency ?? null,
  };
}
