import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function safeNextPath(raw: string | null): string {
  if (!raw) return '/';
  // Reject protocol-relative ("//evil.com"), absolute external URLs,
  // and anything not starting with a single leading slash.
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth?error=oauth`);
}
