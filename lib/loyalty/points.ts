/**
 * Server-side helpers for the loyalty point ledger. Issued ONLY by server
 * actions tied to verified events (e.g. owner-scanned deal_uses). Never
 * expose these from a route that doesn't first validate the underlying
 * action.
 */

export const FREEBIE_POINT_COST = 20;
export const FREEBIE_DISTINCT_PLACES = 5;
export const FREEBIE_RADIUS_KM = 5;

export interface LoyaltyProgress {
  balance: number;
  distinct_places: number;
  freebie_unlocked: boolean;
  points_to_unlock: number;
  places_to_unlock: number;
}

export async function loyaltyProgressFor(db: any, userId: string): Promise<LoyaltyProgress> {
  // Balance via the SQL function we shipped in 006.
  const { data: balRows, error: balanceErr } = await db.rpc('user_point_balance', { uid: userId });
  if (balanceErr) throw balanceErr;
  const balance =
    typeof balRows === 'number' ? balRows : Number(balRows?.[0] ?? 0) || 0;

  // Distinct places redeemed at: distinct (place_id) on deal_purchases that
  // have at least one deal_use.
  const { data: rows, error: purchasesErr } = await db
    .from('deal_purchases')
    .select('place_id, deal_uses!inner(id)')
    .eq('user_id', userId);
  if (purchasesErr) throw purchasesErr;
  const distinct = new Set<string>();
  for (const row of (rows ?? []) as { place_id: string }[]) {
    distinct.add(row.place_id);
  }

  const distinct_places = distinct.size;
  const freebie_unlocked = balance >= FREEBIE_POINT_COST && distinct_places >= FREEBIE_DISTINCT_PLACES;
  return {
    balance,
    distinct_places,
    freebie_unlocked,
    points_to_unlock: Math.max(0, FREEBIE_POINT_COST - balance),
    places_to_unlock: Math.max(0, FREEBIE_DISTINCT_PLACES - distinct_places),
  };
}

export async function awardPointForUse(
  db: any,
  args: {
    user_id: string;
    use_id: string;
    purchase_id: string;
    place_id: string;
    deal_id: string | null;
    is_demo?: boolean;
  },
): Promise<void> {
  const { error } = await db.from('point_events').insert({
    user_id: args.user_id,
    kind: 'earned_use',
    delta: 1,
    related_use_id: args.use_id,
    related_purchase_id: args.purchase_id,
    related_place_id: args.place_id,
    related_deal_id: args.deal_id,
    is_demo: Boolean(args.is_demo),
  });
  if (error) throw error;
}

export async function deductFreebieCost(
  db: any,
  args: { user_id: string; place_id: string; purchase_id: string; is_demo?: boolean },
): Promise<void> {
  const { error } = await db.from('point_events').insert({
    user_id: args.user_id,
    kind: 'spent_freebie',
    delta: -FREEBIE_POINT_COST,
    related_purchase_id: args.purchase_id,
    related_place_id: args.place_id,
    notes: 'Free coffee redemption',
    is_demo: Boolean(args.is_demo),
  });
  if (error) throw error;
}
