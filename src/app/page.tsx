/**
 * Landing Page
 *
 * Root page presenting two paths:
 * - Quick Send: Anonymous upload at /upload (no account needed)
 * - Gallery: Sign in to access encrypted gallery at /gallery
 *
 * @module app/page
 */

"use client";

import { useUser } from "@clerk/nextjs";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, Camera, ChevronDown, Images } from "lucide-react";
import Link from "next/link";
import { useEffect, useCallback, useState } from "react";
import ScrollReveal from "../components/ScrollReveal";
import ShinyText from "../components/ShinyText";
import {
  Status,
  StatusIndicator,
  StatusLabel,
  StatusStats,
} from "../components/ui/shadcn-io/status";

// =============================================================================
// GSAP Plugin Registration
// =============================================================================

try {
  gsap.registerPlugin(ScrollTrigger);
} catch {
  // Plugin already registered - safe to ignore
}

// =============================================================================
// Sub-Components
// =============================================================================

export default function LandingPage() {
  const { isSignedIn } = useUser();
  const [isAboutRevealed, setIsAboutRevealed] = useState(false);
  const handleRevealStart = useCallback(() => setIsAboutRevealed(true), []);
  const [stats, setStats] = useState<{ count: number } | null>(null);

  // retrieve stats
  useEffect(() => {
    void fetch("/api/stats")
      .then((res) => res.json())
      .then(({ count }: { count: number }) => setStats({ count }));
  }, []);

  return (
    <div className="min-h-screen bg-warm-beige flex flex-col">
      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-2xl w-full text-center">
          {/* Branding */}
          <h1 className="font-display text-5xl md:text-6xl font-bold mb-2 text-soft-black">
            ReStrip
          </h1>
          <ShinyText
            text="Photo booth strips that come back to you."
            speed={8}
            delay={0}
            color="#1C1C1C"
            shineColor="#FFC9D1"
            spread={120}
            direction="left"
            yoyo={false}
            pauseOnHover={false}
            disabled={false}
            className="font-display text-xl md:text-3xl font-bold mb-3"
          />
          <p className="font-body text-grey mb-6 max-w-md mx-auto">
            A time machine, home and scrapbook for your photo booth strips.
          </p>

            <div className="mb-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="https://status.restrip.app/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Status status="online">
                  <StatusIndicator />
                  <StatusLabel />
                  <StatusStats count={stats?.count.toString()} />
                </Status>
              </Link>
            </div>

          {/* Dual CTA Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
            {/* Quick Send Card */}
            <Link
              href="/upload"
              className="group bg-white rounded-lg shadow-card hover:shadow-card-hover p-6 transition-shadow duration-200 hover:-translate-y-0.5 text-left flex flex-col"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blush-pink/30 flex items-center justify-center">
                  <Camera className="w-5 h-5 text-soft-black" />
                </div>
                <h2 className="font-display text-lg font-semibold text-soft-black">
                  Quick Send
                </h2>
              </div>
              <p className="text-sm text-grey mb-4">
                Upload your photo strip, pick a future period, and we'll send
                you a surprise. No account needed.
              </p>
              <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-soft-black group-hover:gap-2 transition-all">
                Get started
                <ArrowRight className="w-4 h-4" />
              </span>
            </Link>

            {/* Gallery Card */}
            <Link
              href="/gallery"
              className="group bg-white rounded-lg shadow-card hover:shadow-card-hover p-6 transition-shadow duration-200 hover:-translate-y-0.5 text-left flex flex-col"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blush-pink/30 flex items-center justify-center">
                  <Images className="w-5 h-5 text-soft-black" />
                </div>
                <h2 className="font-display text-lg font-semibold text-soft-black">
                  My Home
                </h2>
              </div>
              <p className="text-sm text-grey mb-4">
                Sign in for gallery and scrapbook, safekeeping your memories.
              </p>
              <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-soft-black group-hover:gap-2 transition-all">
                {isSignedIn ? "Open gallery" : "Sign in"}
                <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
          </div>
          {/* Scroll nudge — visible until the about card enters the viewport */}
          <div
            className={`flex justify-center mt-8 transition-opacity duration-500 ${
              isAboutRevealed ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
          >
            <ChevronDown className="w-5 h-5 text-grey/40 animate-bounce" />
          </div>

          {/* About Section */}
          <div className="max-w-2xl mx-auto mt-2">
            <div className="text-center bg-white rounded-lg shadow-card p-8 transition-shadow">
              <ScrollReveal
                baseOpacity={0}
                enableBlur={true}
                baseRotation={0}
                blurStrength={10}
                onRevealStart={handleRevealStart}
              >
                We live in a world where memories are fleeting, photo strips
                pile up, and feelings fade. ReStrip slows time down. You capture
                a moment today and, months later, it comes back to make you
                smile. ReStrip is a time machine for your happiest moments.
              </ScrollReveal>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-soft-black text-warm-beige py-6">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm">
            &copy; {new Date().getFullYear()} ReStrip, made with ❤️.
          </p>
          <div className="mt-3 flex justify-center space-x-4">
            <a
              href="/privacy-policy"
              className="text-warm-beige hover:underline text-xs"
            >
              Privacy Policy
            </a>
            <a
              href="/contact"
              className="text-warm-beige hover:underline text-xs"
            >
              Contact Us
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
