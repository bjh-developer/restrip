/**
 * Next.js Middleware
 *
 * Handles Supabase auth session refresh and route protection.
 * - Public routes: /, /upload, /auth, /privacy-policy, /contact
 * - Protected routes: /gallery/*, /new (require authenticated session)
 *
 * @module middleware
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** Routes that require an authenticated Supabase session */
const PROTECTED_ROUTES = ["/gallery", "/new"];

/**
 * Checks whether the given pathname starts with any protected route prefix.
 *
 * @param pathname - The request pathname to check
 * @returns True if the route requires authentication
 */
function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh the auth session to keep cookies in sync
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect gallery and new-upload routes
  if (isProtectedRoute(request.nextUrl.pathname)) {
    if (!user) {
      const redirectUrl = new URL("/auth", request.url);
      redirectUrl.searchParams.set("returnTo", request.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static assets (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
