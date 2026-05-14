import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { getDemoSessionFromRequest } from '@/lib/demo/auth';
import { isEmailAllowlisted } from '@/lib/auth/admin-allowlist';

// /profile is intentionally NOT protected — the page itself shows a sign-in
// CTA inline rather than bouncing the user to /auth. This matches the
// integrated panel UX on desktop where Profile is just another panel mode.
const PROTECTED_PREFIXES = ['/admin', '/owner'];
const ADMIN_PREFIX = '/admin';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

// Module-level latch so the missing-env warning fires once per cold start
// instead of once per request. Resets when the function instance recycles.
let hasWarnedMissingEnv = false;

// Renamed from `middleware` → `proxy` for Next.js 16 (#153). Edge runtime
// is NOT supported in `proxy` — runs on Node.js by default, which is fine
// for our Supabase session refresh.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Fail-open if Supabase env isn't configured for this environment (e.g. a
  // Preview deploy where the env vars haven't been ticked for the Preview
  // scope). The previous behaviour was a 500 MIDDLEWARE_INVOCATION_FAILED on
  // every request, which bricked previews entirely. Pages still authorise via
  // `getRequestActor` at the route level, so dropping the middleware gate
  // here only means previews can't redirect signed-out users — they'll see
  // the page-level 401/403 instead. Logging once per cold start so the
  // misconfig is visible in runtime logs without spamming each request.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    if (!hasWarnedMissingEnv) {
      hasWarnedMissingEnv = true;
      console.warn(
        '[proxy] NEXT_PUBLIC_SUPABASE_URL/ANON_KEY missing — auth gate disabled. Add them to this env in Vercel project settings.',
      );
    }
    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const demoSession = user ? null : await getDemoSessionFromRequest(request);

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isProtected && !user && !demoSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Admin allowlist: when ADMIN_EMAIL_ALLOWLIST is set, any signed-in user
  // hitting /admin/* must also be on the list. Demo sessions never qualify.
  // This is the second factor on top of the `is_admin` DB flag — even if a
  // stray `is_admin = true` row slips through, the URL still 404s here.
  const isAdminPath = pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`);
  if (isAdminPath) {
    const email = user?.email ?? null;
    if (!isEmailAllowlisted(email)) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image, favicon, public assets
     * - api routes (handle auth themselves)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)',
  ],
};
