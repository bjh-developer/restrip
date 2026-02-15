/**
 * Protected Layout
 *
 * Wraps all authenticated routes (/gallery, /new) with:
 * - Top navigation bar with logo, nav links, and user button
 * - Consistent page structure and footer
 *
 * Authentication is enforced by Clerk middleware — this layout only
 * renders for authenticated users.
 *
 * @module app/(protected)/layout
 */

"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Images, Plus } from "lucide-react";
import { UserButton } from "@clerk/nextjs";

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
  const pathname = usePathname();

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

              {/* User Button (Clerk) */}
              <div className="ml-2 pl-2 border-l border-mist-grey flex items-center">
                <UserButton afterSignOutUrl="/" />
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
