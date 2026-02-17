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
import { ArrowRight, Camera, Images, Upload, Calendar, Sparkles } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import PillNav from "../components/PillNav";

type HowItWorksStep = {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  iconWrapperClassName: string;
};

type CtaCardConfig = {
  title: string;
  mobileSubtitle: string;
  Icon: React.ComponentType<{ className?: string }>;
  iconWrapperClassName: string;
  desktopTooltip: string;
  onClick: () => void;
};

function HowItWorks({ steps }: { steps: HowItWorksStep[] }) {
  return (
    <div className="flex flex-row gap-2 items-center justify-center text-center mt-6">
      {steps.map((step, idx) => (
        <React.Fragment key={step.label}>
          <div className="flex flex-col items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${step.iconWrapperClassName}`}
            >
              <step.Icon className="w-4 h-4 text-soft-black" />
            </div>
            <span className="text-sm text-grey">{step.label}</span>
          </div>

          {idx < steps.length - 1 && (
            <div className="text-grey/40" aria-hidden="true">
              <ArrowRight className="w-4 h-4" />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function CtaCard({ config }: { config: CtaCardConfig }) {
  const { Icon } = config;

  return (
    <button
      type="button"
      onClick={config.onClick}
      className="group flex items-center gap-3 bg-white rounded-full px-4 py-4 sm:p-3 text-left active:scale-[0.98] transition-transform shadow-sm flex-1 relative"
    >
      <div
        className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0 ${config.iconWrapperClassName}`}
      >
        <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-soft-black" />
      </div>

      <div className="flex-1 min-w-0">
        <h2 className="font-display text-sm sm:text-base font-bold text-soft-black">{config.title}</h2>
        <p className="text-[10px] sm:hidden text-grey">{config.mobileSubtitle}</p>
      </div>

      <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-soft-black opacity-60 group-hover:opacity-100 transition-opacity" />

      {/* Desktop tooltip: kept inline with the card so future tweaks don't require hunting styles elsewhere */}
      <div className="hidden sm:block absolute left-1/2 -translate-x-1/2 top-full mt-1 w-48 p-2 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20 bg-soft-black">
        <p className="text-[10px] leading-tight text-white">{config.desktopTooltip}</p>
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full w-0 h-0 border-l-3 border-r-3 border-b-3 border-transparent border-b-soft-black"></div>
      </div>
    </button>
  );
}

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

  const navItems = [
    { label: "ReStrip", href: "/" },
    { label: "About", href: "/about" },
    { label: "Blog", href: "/blog" },
    { label: "Contact", href: "/contact" },
    { label: "Login", href: "/auth" },
  ];

  const howItWorksSteps: HowItWorksStep[] = [
    { label: "Upload", Icon: Upload, iconWrapperClassName: "bg-blush-pink/20" },
    { label: "Choose date", Icon: Calendar, iconWrapperClassName: "bg-pastel-blue/20" },
    { label: "Get surprised", Icon: Sparkles, iconWrapperClassName: "bg-amber-200/30" },
  ];

  const ctaCards: CtaCardConfig[] = [
    {
      title: "Quick Send",
      mobileSubtitle: "Fast, no-sign-in upload",
      Icon: Camera,
      iconWrapperClassName: "bg-blush-pink/30",
      desktopTooltip: "Send a photo strip memory without signing in. Fast and simple.",
      onClick: handleQuickSend,
    },
    {
      title: "My Gallery",
      mobileSubtitle: "Sign in to access",
      Icon: Images,
      iconWrapperClassName: "bg-pastel-blue/30",
      desktopTooltip: "Sign in to save, view, and manage your encrypted memories.",
      onClick: handleGallery,
    },
  ];

  return (
    <div className="min-h-screen bg-warm-beige relative">
      {/* Main Content */}
      <div className="min-h-screen flex flex-col pb-4 relative z-10">
        {/* Grain overlay - only on beige background, not footer */}
        <div
          className="absolute inset-0 pointer-events-none opacity-25 z-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            backgroundSize: '256px 256px',
          }}
        />
        {/* Navigation */}
        <header className="flex justify-center py-2 shrink-0">
          <PillNav
            items={navItems}
            theme="light"
            initialLoadAnimation={true}
          />
        </header>

        {/* Hero Section - Text Left, Image Right */}
        <section className="px-4 sm:px-6 lg:px-8 py-3 md:py-6 lg:py-8 shrink-0">
          <div className="max-w-2xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 lg:gap-10 items-center">
            {/* Left: Text Content */}
            <div className="text-left order-2 lg:order-1">
              <h1 className="font-display text-[46px] sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tighter leading-tight mb-3 md:mb-4 relative" style={{
                filter: 'drop-shadow(0.5px 0.5px 0px #FEFCF8)',
              }}>
                <span className="relative inline-block" style={{ zIndex: 1 }}>
                  <span style={{
                    background: 'linear-gradient(135deg, #1C1C1C 0%, #2D2D2D 50%, #1C1C1C 100%)',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}>Photo strips that </span><span className="italic mx-1 sm:mx-0" style={{ color: '#E8A5B0' }}>come back</span><span style={{
                    background: 'linear-gradient(135deg, #1C1C1C 0%, #2D2D2D 50%, #1C1C1C 100%)',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}> to you.</span>
                  {/* Decorative underline - hidden on mobile */}
                  <span className="absolute -bottom-1 left-0 w-full h-2 -rotate-1 -z-10 hidden sm:block" style={{ background: 'rgba(255, 201, 209, 0.3)' }} />
                </span>
                {/* Film grain texture overlay - behind text shadows */}
                <span className="absolute inset-0 pointer-events-none opacity-5 mix-blend-overlay" style={{
                  zIndex: -1,
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                  backgroundSize: 'cover',
                }} />
              </h1>
              <p className="font-body text-sm sm:text-base md:text-lg text-grey max-w-md mb-4">
                Upload a photo strip, pick a future period, and we'll send you a surprise reminder. That's it.
              </p>
              
              {/* How It Works */}
              <HowItWorks steps={howItWorksSteps} />
            </div>

            {/* Right: Image */}
            <div className="hidden sm:flex justify-center lg:justify-end order-1 lg:order-2">
              <div className="relative w-full max-w-[280px] sm:max-w-md lg:max-w-xl aspect-[4/3] rounded-2xl overflow-hidden shadow-lg">
                <img 
                  src="/hero.jpg" 
                  alt="ReStrip - Photo strips that come back to you"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Main Content - CTA Cards */}
        <main className="flex items-start justify-center px-4 pt-2 pb-4">
          <div className="max-w-2xl w-full">
            {/* Dual CTA Cards - Mobile: stacked compact rows, Desktop: side by side */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 max-w-lg sm:max-w-none mx-auto">
              {ctaCards.map((config) => (
                <CtaCard key={config.title} config={config} />
              ))}
            </div>

            {/* Privacy note */}
            <p className="mt-3 text-center text-xs text-grey">
              🔐 All images are encrypted before upload. Your memories stay
              private.
            </p>
          </div>
        </main>
      </div>

      {/* Footer - Outside the flex container */}
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
