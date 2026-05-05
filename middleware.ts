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

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
