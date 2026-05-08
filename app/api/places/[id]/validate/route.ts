import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/places/[id]/validate
 *
 * Marks a place as user-validated. Called from the add-place wizard's
 * "Did you mean…?" flow when a user confirms an existing place is real.
 * Auth-gated (401 if no user). Idempotent — re-marking is a no-op.
 *
 * Surfaces the place on the cafés-only default view via the `is_validated`
 * flag exposed in `/api/places` payloads. See #82.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: placeId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  // Demo place ids may be hardcoded strings (e.g. 'ten-belles'). Resolve
  // through place_source_refs the same way reviews / menus do.
  let resolvedId = placeId;
  if (!/^[0-9a-f-]{36}$/i.test(placeId)) {
    const { data: ref } = await supabase
      .from('place_source_refs')
      .select('place_id')
      .eq('normalized_name_hash', `demo:${placeId}`)
      .maybeSingle();
    if (ref?.place_id) resolvedId = ref.place_id;
  }

  // Skip the write if the place is already validated. Avoids both the
  // index churn and the noisier audit trail of overwriting validated_by.
  const { data: existing, error: lookupErr } = await supabase
    .from('places')
    .select('id, user_validated_at')
    .eq('id', resolvedId)
    .maybeSingle();
  if (lookupErr) {
    const code = (lookupErr as { code?: string }).code ?? '';
    const message = (lookupErr as { message?: string }).message ?? '';
    if (code === '42P01' || /relation .* does not exist/i.test(message)) {
      return NextResponse.json({ error: 'table missing' }, { status: 503 });
    }
    if (code === '42703' || /column .* does not exist/i.test(message)) {
      return NextResponse.json({ error: 'column missing' }, { status: 503 });
    }
    return NextResponse.json({ error: message || 'lookup failed' }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: 'place not found' }, { status: 404 });
  }
  if (existing.user_validated_at) {
    return NextResponse.json({ ok: true, already_validated: true });
  }

  const { error: updateErr } = await supabase
    .from('places')
    .update({
      user_validated_at: new Date().toISOString(),
      validated_by: user.id,
    })
    .eq('id', resolvedId);
  if (updateErr) {
    const code = (updateErr as { code?: string }).code ?? '';
    const message = (updateErr as { message?: string }).message ?? '';
    if (code === '42703' || /column .* does not exist/i.test(message)) {
      return NextResponse.json({ error: 'column missing' }, { status: 503 });
    }
    return NextResponse.json({ error: message || 'update failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
