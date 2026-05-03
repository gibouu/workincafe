import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';

const ALLOWED_SLOTS = new Set(['menu', 'inside', 'outside', 'special']);

interface PhotoRow {
  slot: string;
  path: string;
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
}

interface Body {
  photos?: PhotoRow[];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { db, user, isDemo } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { id: reviewId } = await params;
  const body = (await request.json().catch(() => null)) as Body | null;
  const photos = body?.photos?.filter((p) => p && ALLOWED_SLOTS.has(p.slot) && typeof p.path === 'string') ?? [];
  if (photos.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0 });
  }

  const rows = photos.map((p) => ({
    review_id: reviewId,
    slot: p.slot,
    path: p.path,
    width: typeof p.width === 'number' ? p.width : null,
    height: typeof p.height === 'number' ? p.height : null,
    bytes: typeof p.bytes === 'number' ? p.bytes : null,
    ...(isDemo ? { is_demo: true } : {}),
  }));

  const { error } = await db
    .from('review_photos')
    .upsert(rows, { onConflict: 'review_id,slot' });

  if (error) {
    const code = (error as { code?: string }).code ?? '';
    const message = (error as { message?: string }).message ?? '';
    // Demo-mode contract: missing table → soft success
    if (code === '42P01' || /relation .* does not exist/i.test(message)) {
      return NextResponse.json({ ok: true, inserted: 0 }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, inserted: rows.length });
}
