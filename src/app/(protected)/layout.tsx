/**
 * Protected Layout
 *
 * Wraps all authenticated routes (/gallery, /new) with:
 * - Auth gate (redirects to /auth if no session or encryption key)
 * - Top navigation bar with logo, nav links, and sign-out
 * - Consistent page structure and footer
 *
 * @module app/(protected)/layout
 */

"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Images, Plus, LogOut } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

/** Navigation items for the protected area */
const NAV_ITEMS = [
  { href: "/gallery", label: "Gallery", icon: Images },
  { href: "/new", label: "New Memory", icon: Plus },
] as const;

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, hasEncryptionKey, isLoading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  /** Handle sign-out and redirect to landing page */
  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  // Handle redirects in useEffect to avoid "setState during render" error
  useEffect(() => {
    if (isLoading) return;

    // Redirect to auth if no session at all
    if (!user) {
      router.push(`/auth?returnTo=${encodeURIComponent(pathname)}`);
      return;
    }

    // User is authenticated but encryption key expired or missing
    if (!hasEncryptionKey) {
      router.push(`/auth?returnTo=${encodeURIComponent(pathname)}`);
      return;
    }
  }, [user, hasEncryptionKey, isLoading, router, pathname]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-warm-beige flex items-center justify-center">
        <div className="animate-pulse text-grey">Loading...</div>
      </div>
    );
  }

  // Show loading message while redirecting
  if (!user) {
    return (
      <div className="min-h-screen bg-warm-beige flex items-center justify-center">
        <div className="animate-pulse text-grey">Redirecting to sign in...</div>
      </div>
    );
  }

  if (!hasEncryptionKey) {
    return (
      <div className="min-h-screen bg-warm-beige flex items-center justify-center">
        <div className="animate-pulse text-grey">
          Encryption key expired, re-authenticating...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-beige flex flex-col">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-mist-grey shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link
              href="/gallery"
              className="font-display text-xl font-bold text-soft-black hover:opacity-80 transition"
            >
              ReStrip
            </Link>

            {/* Nav Links */}
            <div className="flex items-center gap-1">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                const isActive =
                  pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      isActive
                        ? "bg-blush-pink/20 text-soft-black"
                        : "text-grey hover:text-soft-black hover:bg-mist-grey/50"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{label}</span>
                  </Link>
                );
              })}

              {/* User & Sign Out */}
              <div className="ml-2 pl-2 border-l border-mist-grey flex items-center gap-2">
                <span className="text-xs text-grey hidden md:inline truncate max-w-[140px]">
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm text-grey hover:text-soft-black hover:bg-mist-grey/50 transition"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="bg-soft-black text-warm-beige py-6">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm">
            &copy; {new Date().getFullYear()} ReStrip, made with ❤️.
          </p>
        </div>
      </footer>
    </div>
  );
}
