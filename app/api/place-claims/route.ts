import { NextResponse, type NextRequest } from 'next/server';
import {
  getRequestActor,
  insertWithDemoFlag,
  resolvePlaceIdForActor,
} from '@/lib/auth/request-actor';

const ALLOWED_PROOF_TYPES = new Set([
  'storefront_photo',
  'business_doc',
  'website_email',
  'other',
]);

interface Body {
  place_id?: string;
  claimant_email?: string;
  claimant_name?: string;
  proof_type?: string;
  proof_path?: string;
  proof_notes?: string;
}

export async function POST(request: NextRequest) {
  const { db, user, isDemo } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.place_id) {
    return NextResponse.json({ error: 'place_id required' }, { status: 400 });
  }
  if (!body.claimant_email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.claimant_email)) {
    return NextResponse.json({ error: 'valid claimant_email required' }, { status: 400 });
  }
  if (!body.proof_type || !ALLOWED_PROOF_TYPES.has(body.proof_type)) {
    return NextResponse.json({ error: 'valid proof_type required' }, { status: 400 });
  }

  const placeId = await resolvePlaceIdForActor(db, body.place_id, isDemo);

  const { data, error } = await insertWithDemoFlag(
    db,
    'place_claims',
    {
      place_id: placeId,
      claimant_user_id: user.id,
      claimant_email: body.claimant_email.trim(),
      claimant_name: body.claimant_name?.trim() || null,
      proof_type: body.proof_type,
      proof_path: body.proof_path?.trim() || null,
      proof_notes: body.proof_notes?.slice(0, 500) || null,
    },
    isDemo,
  );

  if (error) {
    const code = (error as { code?: string }).code ?? '';
    const message = (error as { message?: string }).message ?? '';
    if (code === '42P01' || /relation .* does not exist/i.test(message)) {
      return NextResponse.json({ ok: true, id: null }, { status: 503 });
    }
    return NextResponse.json({ error: message || 'insert failed' }, { status: 500 });
  }
  return NextResponse.json({ id: data?.id });
}
