import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Public read. Anyone viewing a place card can see the menus.

interface MenuRow {
  id: string;
  label: string | null;
  cloudinary_public_id: string;
  cloudinary_version: string | null;
  width: number | null;
  height: number | null;
  file_kind: 'image' | 'pdf';
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: placeId } = await params;
  const supabase = await createClient();

  // Resolve demo-string IDs to real UUIDs the same way `/api/places/[id]/reviews`
  // does, so demo place IDs (passed from the hardcoded city arrays) still
  // hit a real row when one exists.
  let resolvedId = placeId;
  if (!/^[0-9a-f-]{36}$/i.test(placeId)) {
    const { data: ref } = await supabase
      .from('place_source_refs')
      .select('place_id')
      .eq('normalized_name_hash', `demo:${placeId}`)
      .maybeSingle();
    if (ref?.place_id) resolvedId = ref.place_id;
  }

  const { data, error } = await supabase
    .from('place_menus')
    .select('id, label, cloudinary_public_id, cloudinary_version, width, height, file_kind')
    .eq('place_id', resolvedId)
    .order('created_at', { ascending: true });

  if (error) {
    // Demo-mode contract: missing table → empty array.
    return NextResponse.json({ menus: [] satisfies MenuRow[] });
  }
  return NextResponse.json({ menus: (data ?? []) as MenuRow[] });
}
