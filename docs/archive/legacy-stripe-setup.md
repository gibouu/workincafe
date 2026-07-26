> **ARCHIVED — historical record only.** This document describes the
> pre-reconstruction application preserved at tag
> `archive/pre-reconstruction-2026-07-21`. It is not instructions and has no
> authority. Superseded by: docs/product-scope.md do-not-build list (payments out of scope). See `docs/RECONSTRUCTION.md`.

# Stripe Connect Express setup

Operator runbook for enabling real card payments + payouts. The app code is wired; flipping it on is a matter of pasting keys + completing dashboard config.

While unset, the app falls back to the demo-pay path automatically (no Stripe calls happen, all purchases use `payment_method='demo'`). The owner dashboard surfaces "Demo mode" instead of the connect button.

## What's already in code

- `lib/payments/env.ts` — `isStripeEnabled()` gates everything on `STRIPE_SECRET_KEY`.
- `lib/payments/stripe.ts` — lazy Stripe client + helpers: `createConnectAccount`, `createOnboardingLink`, `getAccountSummary`, `createCheckoutSession`, `constructEvent`.
- `app/api/stripe/onboard/route.ts` — POST creates Connect account + returns onboarding URL; GET reads cached + fresh status.
- `app/api/stripe/refresh/route.ts` — Stripe redirects expired onboarding links here so we mint a fresh one.
- `app/api/stripe/webhook/route.ts` — signature verification, idempotent dispatch on `account.updated`, `payment_intent.succeeded`, `charge.refunded`, `charge.dispute.*`.
- `components/owner/PayoutsCard.tsx` — owner-facing setup CTA, renders status when connected.
- `supabase/migrations/008_stripe_connect.sql` — `stripe_accounts`, `stripe_events`, plus `payment_status` / `refunded_at` / `application_fee_cents` on `deal_purchases`.

## Step 1 — Stripe account + Connect

1. Create a Stripe account at https://dashboard.stripe.com.
2. **Settings → Connect → Get started.** Choose **platform model**.
3. **Settings → Connect → Onboarding options.** Pick **Express**. Set the brand name + color (this appears on Stripe-hosted Checkout + onboarding pages).
4. **Settings → Public details.** Set the business profile (website, support email, statement descriptor — appears on cardholder statements).
5. **Settings → Tax.** Enable **Stripe Tax** if you want automatic VAT/sales-tax calculation per transaction.

## Step 2 — API keys

Stripe Dashboard → **Developers → API keys**:

- Copy `pk_test_…` (publishable) and `sk_test_…` (secret) for development.
- For production use the live-mode versions (`pk_live_…`, `sk_live_…`).

Add to `.env.local`:

```
STRIPE_SECRET_KEY=sk_test_…
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

In Vercel, set the same vars on the project (production + preview environments).

## Step 3 — Webhook

### Production

Stripe Dashboard → **Developers → Webhooks → Add endpoint**:

- **URL**: `https://workin.cafe/api/stripe/webhook`
- **Events to listen for**:
  - `account.updated`
  - `checkout.session.completed`
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `charge.refunded`
  - `charge.dispute.created`
  - `charge.dispute.closed`
- After saving, copy the **Signing secret** (`whsec_…`) into env:

```
STRIPE_WEBHOOK_SECRET=whsec_…
```

### Local development

Install the Stripe CLI: https://stripe.com/docs/stripe-cli

```bash
stripe login
stripe listen --forward-to http://localhost:3000/api/stripe/webhook
```

The CLI prints a `whsec_…` secret. Copy that into your `.env.local`.

## Step 4 — Apply migration 008

In Supabase Dashboard → SQL Editor, paste the contents of `supabase/migrations/008_stripe_connect.sql` and run.

## Step 5 — Verify

1. Restart `npm run dev` so the new env vars load.
2. Sign in, claim a place, get admin to approve.
3. Visit `/owner` — the **Payouts** card should now say "Not connected" with a "Set up payouts" button.
4. Click it. You'll land on Stripe's hosted onboarding form (use Stripe's test KYC values: business name, fake SSN/SIRET, bank account `000123456789` for FR test).
5. Return to `/owner` — status flips to "Stripe ready" once Stripe sends the `account.updated` webhook.

## Money flow at a glance

```
customer card  →  Stripe processor  →  Stripe Connect account (owner)
                       │
                       ├─→  Stripe processor fee (~1.5% + €0.25 EU)
                       └─→  application_fee_amount (5% + €0.25)  →  Platform balance
```

`lib/loyalty/fees.ts:computeFee` computes `application_fee_amount`. Re-tune the percentage there.

## Out of scope until Stripe is live

- The current `/api/deals/[id]/purchase` flow returns the QR + ticket synchronously on the demo path. Switching to Stripe Checkout requires a `pending` row pre-checkout + a webhook handler that flips `payment_status='paid'` AND issues the QR. That's a follow-up PR — the data model is ready (`payment_status` enum + `payment_intent_id` column).
- Refund initiation UI for owners (admins can refund manually via Stripe Dashboard for now).
- Owner KYC re-verification when Stripe asks for additional info post-onboarding (handled via the existing `/api/stripe/refresh` link).

## Cost reference (EU cards)

| Layer | Take |
| --- | --- |
| Stripe processor | 1.5% + €0.25 |
| Platform (us) | 5% + €0.25 |
| Stripe Tax (if enabled) | 0.5% per calculated transaction |

Example €4.00 deal:
- Customer pays €4.00
- Stripe takes ~€0.31
- Platform takes €0.45 (5% × €4 + €0.25)
- Owner receives ~€3.24 to their Stripe balance, paid out per Stripe's schedule.
