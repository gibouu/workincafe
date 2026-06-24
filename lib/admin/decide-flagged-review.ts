// Shared flagged-review decision logic (#167). Used by the single-row
// decision route and the bulk endpoint so the two can't drift.
//
// `request_status` enum is ('pending','approved','rejected'); admin actions
// map onto it and the specific action is recorded in `resolution`. See #28.
import type { createAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;

export type FlagDecision = 'dismiss' | 'hide' | 'ban';

export type DecisionResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export async function applyFlaggedReviewDecision(
  admin: AdminClient,
  flagId: string,
  decision: FlagDecision,
  reason: string | undefined,
  reviewerId: string,
): Promise<DecisionResult> {
  const { error } = await admin.rpc('decide_flagged_review', {
    p_flag_id: flagId,
    p_decision: decision,
    p_reason: reason?.trim() || null,
    p_reviewer_id: reviewerId,
  });

  if (error) {
    const message = error.message ?? 'flag decision failed';
    if (/flag not found/i.test(message)) {
      return { ok: false, status: 404, error: 'flag not found' };
    }
    if (/flag already decided/i.test(message)) {
      return { ok: false, status: 409, error: 'flag already decided' };
    }
    if (/underlying review missing/i.test(message)) {
      return { ok: false, status: 410, error: 'underlying review missing' };
    }
    return { ok: false, status: 500, error: message };
  }

  return { ok: true };
}
