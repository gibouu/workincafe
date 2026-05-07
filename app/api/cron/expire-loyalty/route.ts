import { NextResponse, type NextRequest } from 'next/server';
import { verifyCronRequest } from '@/lib/cron/auth';
import { createAdminClient } from '@/lib/supabase/admin';

// Loyalty point expiry sweep. Runs nightly (configured in vercel.json).
//
// Model: a single SQL pass per user computes how much "old" earned balance
// is still on the books and inserts one balancing `expired` row to retire
// it. Capped to the user's current balance so spends are honoured FIFO-ish:
//
//   to_expire = min(
//     old_earned    -- sum of earned_use events older than 12 months
//     - already_expired,  -- sum of all 'expired' rows already inserted
//     current_balance     -- to never push the balance negative
//   )
//
// Idempotent: re-running the next day just produces 0 candidates because
// `already_expired` now covers what was inserted last time. See #23.
export async function POST(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Heavy lifting lives in the SECURITY DEFINER function created by
  // migration 014_cron_helpers.sql so it can run as a single atomic
  // statement under the service role. RPC returns { rows_expired }.
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('cron_expire_loyalty');
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const rows = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({
    ok: true,
    rows_expired: (rows as { rows_expired?: number } | null)?.rows_expired ?? 0,
  });
}

// Allow GET so a human can hit the endpoint with a Bearer token from a
// browser / curl when ad-hoc runs are needed. Same auth check.
export async function GET(request: NextRequest) {
  return POST(request);
}
