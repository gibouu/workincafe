import { NextResponse, type NextRequest } from 'next/server';
import { verifyCronRequest } from '@/lib/cron/auth';
import { createAdminClient } from '@/lib/supabase/admin';

// stripe_events table prune.
//
// Stripe webhook receipts pile up indefinitely otherwise. Spec says keep 90
// days for audit, hard-delete the rest. Idempotent — repeated runs just
// delete 0 rows once the cutover catches up.
//
// See #23.
const RETENTION_DAYS = 90;

export async function POST(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const admin = createAdminClient();
  const { error, count } = await admin
    .from('stripe_events')
    .delete({ count: 'exact' })
    .lt('processed_at', cutoff);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, rows_deleted: count ?? 0, cutoff });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
