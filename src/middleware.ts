/**
 * Next.js Middleware
 *
 * Uses Clerk for auth session management and route protection.
 * - Public routes: /, /upload, /privacy-policy, /contact, /sign-in, /sign-up
 * - Protected routes: /gallery/*, /new, /memory/* (require authenticated session)
 *
 * @module middleware
 */

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/gallery(.*)",
  "/new(.*)",
  "/memory(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
