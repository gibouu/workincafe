/**
 * Stripe / payments env. When STRIPE_SECRET_KEY is unset, the app runs in
 * demo-pay mode — all purchases use payment_method='demo' and no Stripe
 * calls happen. As soon as keys land in env, the purchase flow flips.
 */

export function stripeSecretKey(): string | null {
  const k = process.env.STRIPE_SECRET_KEY;
  return k && k.trim().length > 0 ? k : null;
}

export function stripeWebhookSecret(): string | null {
  const k = process.env.STRIPE_WEBHOOK_SECRET;
  return k && k.trim().length > 0 ? k : null;
}

export function publishableKey(): string | null {
  const k = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  return k && k.trim().length > 0 ? k : null;
}

export function isStripeEnabled(): boolean {
  return stripeSecretKey() !== null;
}

export function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_URL?.startsWith('http')
      ? process.env.VERCEL_URL!
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000'
  );
}
