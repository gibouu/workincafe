import { jwtVerify, SignJWT } from 'jose';
import type { NextRequest } from 'next/server';

export const DEMO_SESSION_COOKIE = 'wic_demo_session';
export const DEMO_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export type DemoSession = {
  userId: string;
  email: string;
  name: string;
  isDemo: true;
};

const encoder = new TextEncoder();
const LOCAL_DEMO_AUTH_SECRET = 'workincafe-local-demo-auth-secret';

export function isDemoAuthEnabled() {
  if (process.env.NODE_ENV !== 'production') return true;
  return process.env.DEMO_AUTH_ENABLED === 'true' && Boolean(process.env.DEMO_AUTH_SECRET);
}

function demoSecret() {
  const configured = process.env.DEMO_AUTH_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV !== 'production') return LOCAL_DEMO_AUTH_SECRET;
  throw new Error('DEMO_AUTH_SECRET is required when demo auth is enabled in production');
}

export async function signDemoSession(session: DemoSession) {
  return new SignJWT({
    email: session.email,
    name: session.name,
    isDemo: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime(`${DEMO_SESSION_MAX_AGE}s`)
    .sign(encoder.encode(demoSecret()));
}

export async function verifyDemoSessionToken(token: string | undefined): Promise<DemoSession | null> {
  if (!token || !isDemoAuthEnabled()) return null;

  try {
    const { payload } = await jwtVerify(token, encoder.encode(demoSecret()));
    if (payload.isDemo !== true || !payload.sub) return null;
    return {
      userId: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : 'demo@workin.cafe',
      name: typeof payload.name === 'string' ? payload.name : 'Demo Tester',
      isDemo: true,
    };
  } catch {
    return null;
  }
}

export async function getDemoSessionFromRequest(request: NextRequest) {
  return verifyDemoSessionToken(request.cookies.get(DEMO_SESSION_COOKIE)?.value);
}

export function demoSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DEMO_SESSION_MAX_AGE,
  };
}
