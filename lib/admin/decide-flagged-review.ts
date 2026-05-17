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
  const { data: flag, error: flagErr } = await admin
    .from('flagged_reviews')
    .select('id, review_id, status, reviews(id, user_id)')
    .eq('id', flagId)
    .maybeSingle();
  if (flagErr) return { ok: false, status: 500, error: flagErr.message };
  if (!flag) return { ok: false, status: 404, error: 'flag not found' };
  if (flag.status !== 'pending') {
    return { ok: false, status: 409, error: 'flag already decided' };
  }

  // PostgREST may return the related row as an object or a single-element
  // array depending on cardinality; each flag links exactly one review.
  const review = (Array.isArray(flag.reviews) ? flag.reviews[0] : flag.reviews) as
    | { id: string; user_id: string }
    | null;

  if ((decision === 'hide' || decision === 'ban') && !review) {
    return { ok: false, status: 410, error: 'underlying review missing' };
  }

  // Hide before ban so the user-facing impact is immediate even if the
  // ban write later fails.
  if (decision === 'hide' || decision === 'ban') {
    const { error: revErr } = await admin
      .from('reviews')
      .update({ is_hidden: true })
      .eq('id', review!.id);
    if (revErr) return { ok: false, status: 500, error: revErr.message };
  }

  if (decision === 'ban') {
    const { error: banErr } = await admin
      .from('users')
      .update({ is_banned: true })
      .eq('id', review!.user_id);
    if (banErr) return { ok: false, status: 500, error: banErr.message };
  }

  const status = decision === 'dismiss' ? 'rejected' : 'approved';
  const resolutionParts: string[] = [decision];
  const trimmed = reason?.trim();
  if (trimmed) resolutionParts.push(trimmed);
  const { error: updErr } = await admin
    .from('flagged_reviews')
    .update({
      status,
      resolved_by: reviewerId,
      resolved_at: new Date().toISOString(),
      resolution: resolutionParts.join(' · '),
    })
    .eq('id', flagId);
  if (updErr) return { ok: false, status: 500, error: updErr.message };

  return { ok: true };
}
