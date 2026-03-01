"use client";

import { useEffect } from "react";
import { Mail, Instagram, Linkedin, MessageCircle } from "lucide-react";
import Link from "next/link";
import { loadUserJot } from "../../../lib/userjot";

export default function ContactPage() {
  useEffect(() => {
    return loadUserJot("cmik6o1zx04nt15mqotv6d58d");
  }, []);

  const socials = [
    {
      icon: Mail,
      label: "Email",
      description: "Send an email to ReStrip team",
      href: "mailto:hello@restrip.app",
      color: "text-soft-black",
    },
    {
      icon: Instagram,
      label: "Instagram",
      description: "Follow ReStrip for updates",
      href: "https://www.instagram.com/restrip.official",
      target: "_blank",
      color: "text-soft-black",
    },
    {
      icon: Linkedin,
      label: "LinkedIn",
      description: "Connect with ReStrip team",
      href: "https://www.linkedin.com/company/restrip-app",
      target: "_blank",
      color: "text-soft-black",
    },
  ];

  return (
    <div className="min-h-screen bg-warm-beige py-16 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="font-display text-5xl md:text-6xl font-bold text-soft-black mb-4">
            Let's talk
          </h1>
        </div>

        {/* Socials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {socials.map((social) => {
            const Icon = social.icon;
            return (
              <a
                key={social.label}
                href={social.href}
                target={social.target}
                rel={social.target ? "noopener noreferrer" : undefined}
                className="bg-white rounded-lg shadow-card p-8 text-center hover:shadow-card-hover transition-all hover:-translate-y-1 group"
              >
                <div className="w-14 h-14 bg-pastel-blue rounded-lg mx-auto mb-4 flex items-center justify-center">
                  <Icon className={`w-7 h-7 ${social.color}`} />
                </div>
                <h3 className="font-display text-xl font-semibold text-soft-black mb-1">
                  {social.label}
                </h3>
                <p className="font-body text-sm text-grey">
                  {social.description}
                </p>
              </a>
            );
          })}
        </div>

        {/* Feedback Board Section */}
        <div className="bg-white rounded-lg shadow-card p-8 md:p-12">
          <div className="flex items-center gap-3 mb-6">
            <MessageCircle className="w-6 h-6 text-blush-pink" />
            <h2 className="font-display text-2xl md:text-3xl font-bold text-soft-black">
              Help shape ReStrip
            </h2>
          </div>

          <p className="font-body text-grey mb-8">
            Have feedback? Want to see what&apos;s coming next? Our feedback board is
            where ideas happen.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="https://restrip.userjot.com/"
              className="inline-block bg-blush-pink text-soft-black rounded-lg px-6 py-3 font-body font-semibold hover:shadow-lg transition-all hover:-translate-y-0.5 text-center"
            >
              Share Feedback
            </a>
            <a
              href="https://restrip.userjot.com/roadmap"
              className="inline-block bg-pastel-blue text-soft-black rounded-lg px-6 py-3 font-body font-semibold hover:shadow-lg transition-all hover:-translate-y-0.5 text-center"
            >
              View Roadmap
            </a>
            <a
              href="https://restrip.userjot.com/updates"
              className="inline-block bg-mist-grey text-soft-black rounded-lg px-6 py-3 font-body font-semibold hover:shadow-lg transition-all hover:-translate-y-0.5 text-center"
            >
              View Updates
            </a>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="mt-16 text-center">
          <Link
            href="/"
            className="inline-block bg-blush-pink text-soft-black rounded-lg px-8 py-3 font-body font-semibold hover:shadow-lg transition-all hover:bg-yellow-cream"
          >
            Back to Upload
          </Link>
        </div>
      </div>
    </div>
  );
}
