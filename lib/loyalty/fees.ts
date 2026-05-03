/**
 * Platform fee math.
 *
 * Owner sees: card processor fee (Stripe / Square — set by them) + our
 * platform fee (this file). On a €4 deal:
 *   platform fee = 5% × €4 + €0.25 = €0.45
 *
 * Re-tune this in one place.
 */

export const PLATFORM_FEE_PERCENT = 0.05;
export const PLATFORM_FEE_FLAT_CENTS = 25;

export interface FeeBreakdown {
  /** What the customer pays. */
  total_cents: number;
  /** Our platform fee. */
  platform_fee_cents: number;
  /** What the owner receives (before processor fees, which Stripe/Square deduct). */
  owner_receives_cents: number;
}

export function computeFee(amount_cents: number): FeeBreakdown {
  const platform_fee_cents =
    Math.round(amount_cents * PLATFORM_FEE_PERCENT) + PLATFORM_FEE_FLAT_CENTS;
  return {
    total_cents: amount_cents,
    platform_fee_cents,
    owner_receives_cents: Math.max(0, amount_cents - platform_fee_cents),
  };
}

export function formatCents(cents: number, currency = 'EUR'): string {
  const symbol = currency === 'EUR' ? '€' : currency === 'CAD' ? 'C$' : currency + ' ';
  const value = (cents / 100).toFixed(2);
  return `${symbol}${value}`;
}
