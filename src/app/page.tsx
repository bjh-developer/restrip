"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../hooks/useAuth";
import PillNav from "../components/PillNav";
import { ArrowRight, Camera, Images, Upload, Calendar, Sparkles, Lock } from "lucide-react";

const HOW_IT_WORKS_STEPS = [
  { label: "Upload", Icon: Upload, description: "Scan your strip", color: "#EBEBEB" },
  { label: "Choose date", Icon: Calendar, description: "Pick a future date", color: "#FFF2C9" },
  { label: "Get surprised", Icon: Sparkles, description: "The magic arrives", color: "#FEFCF8" },
];

const NAV_ITEMS = [
  { label: "ReStrip", href: "/" },
  { label: "About", href: "/about" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
  { label: "Login", href: "/auth" },
];

export default function LandingPage() {
  const router = useRouter();
  const { user, hasEncryptionKey } = useAuth();

  const handleQuickSend = () => {
    router.push("/upload");
  };

  const handleGallery = () => {
    if (user && hasEncryptionKey) {
      router.push("/gallery");
    } else {
      router.push("/auth");
    }
  };

  const navItems = NAV_ITEMS;

  const howItWorksSteps = HOW_IT_WORKS_STEPS;

  return (
    <div className="min-h-screen bg-warm-beige relative flex flex-col">
      <div className="flex-1 flex flex-col relative z-10">
        {/* Grain overlay */}
        <div
          className="fixed inset-0 pointer-events-none opacity-[0.15] z-0 mix-blend-multiply"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundSize: '200px 200px',
          }}
        />
        <header className="flex justify-center py-2 shrink-0">
          <PillNav items={navItems} theme="light" initialLoadAnimation />
        </header>

        <section className="px-4 sm:px-6 lg:px-8 py-2 md:py-6 shrink-0 flex-1 flex items-center justify-center">
          <div className="max-w-4xl mx-auto flex flex-col lg:flex-row items-center justify-center gap-6">
            {/* Left: Text Content */}
            <div className="text-center lg:text-left py-1 max-w-sm">
              <h1 className="font-display text-[42px] sm:text-[46px] md:text-[52px] lg:text-[58px] font-bold tracking-tighter leading-[1.05] text-soft-black mb-4">
                Missing your photo strips?
              </h1>
              <p className="font-body text-lg sm:text-xl text-[#1C1C1C]/80 leading-relaxed mb-6">
                A time machine, home and scrapbook for your photo booth strips.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleQuickSend}
                  className="group px-8 py-4 bg-[#FFC9D1] text-soft-black font-semibold rounded-full hover:bg-[#FFB3C1] transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 flex items-center justify-center gap-2 text-sm font-sans"
                >
                  <Camera className="w-4 h-4" />
                  Quick Send
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={handleGallery}
                  className="group px-8 py-4 bg-transparent text-soft-black font-semibold rounded-full hover:bg-white/50 transition-all duration-300 flex items-center justify-center gap-2 text-sm font-sans border border-soft-black/20"
                >
                  My Home
                </button>
              </div>
            </div>

            <div className="flex justify-center order-first lg:order-last mb-6 lg:mb-0">
              <div className="relative w-full max-w-[280px] sm:max-w-[340px] lg:max-w-[360px] aspect-[4/3] rounded-2xl overflow-hidden shadow-[0_20px_60px_-15px_rgba(28,28,28,0.08)] ring-4 ring-white/60">
                <img
                  src="/hero.jpg"
                  alt="ReStrip - Photo booth strips that come back to you"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="shrink-0 px-4 py-3">
          <div className="max-w-4xl w-full mx-auto">
            <div className="text-center mb-6">
              <p className="text-[11px] font-semibold text-soft-black uppercase tracking-[0.2em] mb-2">How It Works</p>
            </div>
            <div className="flex items-center justify-center gap-3 sm:gap-6 mb-6">
              {HOW_IT_WORKS_STEPS.map((step, idx) => (
                <React.Fragment key={step.label}>
                  <div className="flex flex-col items-center text-center w-28 sm:w-36">
                    <div
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mb-2"
                      style={{ backgroundColor: step.color }}
                    >
                      <step.Icon className="w-6 h-6 sm:w-7 sm:h-7 text-soft-black font-normal" />
                    </div>
                    <span className="text-sm sm:text-base text-soft-black font-normal">{step.label}</span>
                    <span className="text-[11px] text-[#1C1C1C]/70 leading-tight mt-1">{step.description}</span>
                  </div>
                  {idx < 2 && (
                    <div className="flex items-center self-start mt-6">
                      <ArrowRight className="w-6 h-6 sm:w-7 sm:h-7 text-soft-black/30" />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Trust Pills */}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#EBEBEB]/10 rounded-full text-[10px] text-[#1C1C1C]/60">
                <Lock className="w-3 h-3" /> End-to-end encrypted
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#EBEBEB]/10 rounded-full text-[10px] text-[#1C1C1C]/60">
                <Images className="w-3 h-3" /> 1,240 memories shared
              </span>
            </div>
          </div>
        </section>
      </div>

        {/* Footer */}
      <footer className="text-[#FEFCF8] py-6" style={{ backgroundColor: '#1C1C1C' }}>
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm">
            &copy; {new Date().getFullYear()} ReStrip, made with ❤️, by{" "}
            <a
              href="https://www.linkedin.com/in/bek-joon-hao/"
              className="hover:underline transition-all hover:text-[#CFE7FF]"
            >
              Joon Hao
            </a>
            .
          </p>
          <div className="mt-3 flex justify-center space-x-4">
            <a
              href="/privacy-policy"
              className="text-[#FEFCF8] hover:underline text-xs"
            >
              Privacy Policy
            </a>
            <a
              href="/contact"
              className="text-[#FEFCF8] hover:underline text-xs"
            >
              Contact Us
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
