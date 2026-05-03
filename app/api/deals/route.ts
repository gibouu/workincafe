import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor, isOwnerOf } from '@/lib/auth/request-actor';

interface Body {
  place_id?: string;
  title?: string;
  description?: string;
  kind?: 'single_use' | 'pack';
  pack_size?: number;
  price_cents?: number;
  currency?: string;
  starts_at?: string;
  ends_at?: string | null;
  purchase_limit_per_user?: number | null;
  active?: boolean;
}

export async function POST(request: NextRequest) {
  const { db, user, isDemo } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.place_id || !body.title || typeof body.price_cents !== 'number') {
    return NextResponse.json(
      { error: 'place_id, title, price_cents required' },
      { status: 400 },
    );
  }
  if (body.kind !== 'single_use' && body.kind !== 'pack') {
    return NextResponse.json({ error: "kind must be 'single_use' or 'pack'" }, { status: 400 });
  }
  const pack_size = body.kind === 'pack' ? Math.max(1, Math.floor(body.pack_size ?? 10)) : 1;
  if (pack_size > 100) {
    return NextResponse.json({ error: 'pack_size max 100' }, { status: 400 });
  }
  if (body.price_cents < 0) {
    return NextResponse.json({ error: 'price_cents must be >= 0' }, { status: 400 });
  }

  const owns = await isOwnerOf(db, body.place_id, user.id);
  if (!owns) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { data, error } = await db
    .from('deals')
    .insert({
      place_id: body.place_id,
      created_by: user.id,
      title: body.title.trim().slice(0, 80),
      description: body.description?.trim().slice(0, 280) ?? null,
      kind: body.kind,
      pack_size,
      price_cents: Math.round(body.price_cents),
      currency: body.currency ?? 'EUR',
      starts_at: body.starts_at ?? new Date().toISOString(),
      ends_at: body.ends_at ?? null,
      purchase_limit_per_user: body.purchase_limit_per_user ?? null,
      active: Boolean(body.active),
      ...(isDemo ? { is_demo: true } : {}),
    })
    .select('id')
    .maybeSingle();

  if (error) {
    const code = (error as { code?: string }).code ?? '';
    const message = (error as { message?: string }).message ?? '';
    if (code === '42P01' || /relation .* does not exist/i.test(message)) {
      return NextResponse.json({ error: 'table missing' }, { status: 503 });
    }
    return NextResponse.json({ error: message || 'insert failed' }, { status: 500 });
  }
  return NextResponse.json({ id: data?.id });
}
