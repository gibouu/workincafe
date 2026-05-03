import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';

export async function GET(request: NextRequest) {
  const { user, isDemo } = await getRequestActor(request);
  if (!user) {
    return NextResponse.json({
      signedIn: false,
      name: null,
      email: null,
      isDemo: false,
    });
  }
  return NextResponse.json({
    signedIn: true,
    name: user.name ?? user.email ?? null,
    email: user.email,
    isDemo,
  });
}
