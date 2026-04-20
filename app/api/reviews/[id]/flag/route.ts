import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { FlagReason } from '@/types/database';

const REASONS: FlagReason[] = ['spam', 'offensive', 'untrue', 'irrelevant', 'other'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { id: reviewId } = await params;
  const body = (await request.json().catch(() => null)) as {
    reason?: string;
    notes?: string;
  } | null;
  if (!body?.reason || !REASONS.includes(body.reason as FlagReason)) {
    return NextResponse.json({ error: 'reason is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('flagged_reviews')
    .insert({
      review_id: reviewId,
      reporter_id: user.id,
      reason: body.reason as FlagReason,
      notes: body.notes?.slice(0, 280) ?? null,
    })
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id });
}
