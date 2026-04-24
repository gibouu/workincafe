import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor, insertWithDemoFlag } from '@/lib/auth/request-actor';
import type { FlagReason } from '@/types/database';

const REASONS: FlagReason[] = ['spam', 'offensive', 'untrue', 'irrelevant', 'other'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { db, user, isDemo } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { id: reviewId } = await params;
  const body = (await request.json().catch(() => null)) as {
    reason?: string;
    notes?: string;
  } | null;
  if (!body?.reason || !REASONS.includes(body.reason as FlagReason)) {
    return NextResponse.json({ error: 'reason is required' }, { status: 400 });
  }

  const { data, error } = await insertWithDemoFlag(
    db,
    'flagged_reviews',
    {
      review_id: reviewId,
      reporter_id: user.id,
      reason: body.reason as FlagReason,
      notes: body.notes?.slice(0, 280) ?? null,
    },
    isDemo,
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id });
}
