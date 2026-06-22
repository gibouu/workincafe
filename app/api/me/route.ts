import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';

function signedOutResponse() {
  return NextResponse.json({
    signedIn: false,
    name: null,
    email: null,
    isDemo: false,
  });
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function GET(request: NextRequest) {
  if (!hasSupabaseEnv()) return signedOutResponse();

  const { user, isDemo } = await getRequestActor(request);
  if (!user) {
    return signedOutResponse();
  }
  return NextResponse.json({
    signedIn: true,
    name: user.name ?? user.email ?? null,
    email: user.email,
    isDemo,
  });
}
