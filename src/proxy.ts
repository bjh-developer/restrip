/**
 * Next.js Proxy
 *
 * Runs on every non-static request to:
 * 1. Generate a fresh cryptographic nonce for Content-Security-Policy.
 * 2. Set the CSP response header using that nonce + 'strict-dynamic'.
 * 3. Forward the nonce as an 'x-nonce' request header so server components
 *    (e.g. the root layout) can stamp the same nonce onto their own <script>
 *    tags. Next.js itself also reads 'x-nonce' and applies it automatically to
 *    its internal bootstrap scripts.
 * 4. Enforce Clerk session authentication on protected routes.
 *
 * CSP strategy:
 *   'nonce-${nonce}'  → enforced in all modern browsers (CSP level 2+);
 *                       Next.js applies the nonce to every script tag it emits
 *                       via the x-nonce request header.
 *   'strict-dynamic'  → propagates trust from nonce-bearing scripts to all
 *                       scripts they dynamically load; required for Turnstile
 *                       (api.js lazy-loads worker chunks) and Clerk sub-scripts.
 *                       Host allowlists are ignored in browsers that support it.
 *   'unsafe-inline'   → silently ignored when a nonce is present; kept only as
 *                       a last-resort fallback for very old browsers
 *   Clerk host        → clerk.restrip.app kept as a fallback for browsers that
 *                       don't support strict-dynamic
 *
 * Protected routes: /gallery/*, /new, /scrapbook/* (require authenticated session)
 * Public routes: /, /upload, /privacy-policy, /contact, /sign-in, /sign-up
 *
 * @module proxy
 */

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/gallery(.*)",
  "/new(.*)",
  "/scrapbook(.*)",
]);

export default clerkMiddleware(async (auth, request: NextRequest) => {
  // Enforce auth on protected routes (redirects automatically if unauthorized)
  if (isProtectedRoute(request)) {
    await auth.protect();
  }

  // Generate a fresh random nonce for every request
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const csp = [
    "default-src 'self'",
    // Per Clerk docs: 'self' 'strict-dynamic' 'nonce-...' https:
    // strict-dynamic propagates nonce trust to dynamically-created scripts (Clerk
    // sub-scripts, Turnstile worker chunks). Host allowlists are ignored in browsers
    // that support strict-dynamic; https: remains as a silent fallback for older
    // browsers. 'unsafe-inline' is ignored when a nonce is present (old-browser fallback).
    // Per Clerk docs the dynamic prop on <ClerkProvider> is required so that Next.js
    // forces dynamic rendering — preventing a cached nonce from going stale vs the
    // per-request CSP header.
    `script-src 'self' 'strict-dynamic' 'nonce-${nonce}' https: 'unsafe-inline' 'unsafe-eval'`,
    "style-src 'self' 'unsafe-inline'", // unsafe-inline required for Tailwind + styled-jsx
    "img-src 'self' data: blob: https: https://img.clerk.com",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.vercel-analytics.com https://*.vercel-insights.com https://*.userjot.com https://*.clerk.accounts.dev https://*.clerk.dev https://clerk-telemetry.com https://clerk.restrip.app https://cloudflareinsights.com",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "frame-src 'self' https://*.clerk.accounts.dev https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  // Attach nonce to the request so server components can read it via headers()
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  // Set the CSP on the response so the browser enforces it
  response.headers.set("Content-Security-Policy", csp);
  return response;
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
