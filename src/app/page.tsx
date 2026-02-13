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

import React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Camera, Images } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import ShinyText from "../components/ShinyText";

export default function LandingPage() {
  const router = useRouter();
  const { user, hasEncryptionKey } = useAuth();

  /** Navigate to the anonymous quick-send upload flow */
  const handleQuickSend = () => {
    router.push("/upload");
  };

  /** Navigate to gallery (or auth page if not signed in) */
  const handleGallery = () => {
    if (user && hasEncryptionKey) {
      router.push("/gallery");
    } else {
      router.push("/auth");
    }
  };

  return (
    <div className="min-h-screen bg-warm-beige flex flex-col">
      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-2xl w-full text-center">
          {/* Branding */}
          <h1 className="font-display text-5xl md:text-6xl font-bold mb-3 text-soft-black">
            ReStrip
          </h1>
          <ShinyText
            text="Photo strips that come back to you."
            disabled={false}
            speed={15}
            className="font-display text-2xl md:text-3xl font-semibold text-soft-black mb-4"
          />
          <p className="font-body text-grey mb-12 max-w-md mx-auto">
            Upload a photo strip, pick a future period, and we&apos;ll send you
            a surprise reminder. That&apos;s it.
          </p>

          {/* Dual CTA Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
            {/* Quick Send Card */}
            <button
              type="button"
              onClick={handleQuickSend}
              className="group bg-white rounded-xl shadow-card hover:shadow-card-hover p-6 transition-all duration-200 hover:-translate-y-0.5 text-left"
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
                Send a photo strip memory without signing in. Fast and simple.
              </p>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-soft-black group-hover:gap-2 transition-all">
                Get started
                <ArrowRight className="w-4 h-4" />
              </span>
            </button>

            {/* Gallery Card */}
            <button
              type="button"
              onClick={handleGallery}
              className="group bg-white rounded-xl shadow-card hover:shadow-card-hover p-6 transition-all duration-200 hover:-translate-y-0.5 text-left"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-pastel-blue/30 flex items-center justify-center">
                  <Images className="w-5 h-5 text-soft-black" />
                </div>
                <h2 className="font-display text-lg font-semibold text-soft-black">
                  My Gallery
                </h2>
              </div>
              <p className="text-sm text-grey mb-4">
                Sign in to save, view, and manage your encrypted memories.
              </p>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-soft-black group-hover:gap-2 transition-all">
                {user && hasEncryptionKey
                  ? "Open gallery"
                  : user
                  ? "Set up encryption key"
                  : "Sign in"}
                <ArrowRight className="w-4 h-4" />
              </span>
            </button>
          </div>

          {/* Privacy note */}
          <p className="mt-8 text-xs text-grey">
            🔐 All images are encrypted before upload. Your memories stay
            private.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-soft-black text-warm-beige py-6">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm">
            &copy; {new Date().getFullYear()} ReStrip, made with ❤️, by{" "}
            <a
              href="https://www.linkedin.com/in/bek-joon-hao/"
              className="hover:underline transition-all hover:text-pastel-blue"
            >
              Joon Hao
            </a>
            .
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
