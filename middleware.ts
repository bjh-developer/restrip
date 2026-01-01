import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

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
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  // Protected routes - redirect to home if not authenticated
  if (request.nextUrl.pathname.startsWith('/upload')) {
    if (!session) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // If user is authenticated and visits root, redirect to upload
  if (request.nextUrl.pathname === '/') {
    if (session) {
      // Check if user has encryption key set (we can't check this in middleware)
      // So we'll let the page handle this logic
      // For now, just let authenticated users through to the auth page
      // The page will redirect them if they have full auth
    }
  }

  return response;
}

export const config = {
  matcher: ['/', '/upload/:path*'],
};
