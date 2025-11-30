"use client";
import { useEffect } from "react";
import { Shield, Trash2, Eye, Lock } from "lucide-react";

export default function PrivacyPage() {
  useEffect(() => {
    // Load UserJot SDK
    const script1 = document.createElement("script");
    script1.innerHTML = `window.$ujq=window.$ujq||[];window.uj=window.uj||new Proxy({},{get:(_,p)=>(...a)=>window.$ujq.push([p,...a])});document.head.appendChild(Object.assign(document.createElement('script'),{src:'https://cdn.userjot.com/sdk/v2/uj.js',type:'module',async:!0}));`;
    document.head.appendChild(script1);

    // Initialize UserJot
    const script2 = document.createElement("script");
    script2.innerHTML = `
          window.uj.init('cmik6o1zx04nt15mqotv6d58d', {
            widget: true,
            position: 'right',
            theme: 'auto'
          });
        `;
    document.head.appendChild(script2);
  }, []);

  const principles = [
    {
      icon: Eye,
      title: "Your photos are yours",
      description:
        "We don't claim ownership. We don't use them for marketing. They belong to you, and only you.",
    },
    {
      icon: Lock,
      title: "No AI training",
      description:
        "Your photos will never be used to train AI models. We don't feed our machine learning with your memories.",
    },
    {
      icon: Trash2,
      title: "Temporary storage",
      description:
        "We only store your photo long enough to send your future surprise email. After that, it's gone.",
    },
    {
      icon: Shield,
      title: "No selling",
      description:
        "We never sell your data. Not now, not ever. Your memories aren't for sale.",
    },
  ];

  return (
    <div className="min-h-screen bg-warm-beige py-16 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="font-display text-5xl md:text-6xl font-bold text-soft-black mb-4">
            Privacy Policy
          </h1>
        </div>

        {/* Core Principles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {principles.map((principle) => {
            const Icon = principle.icon;
            return (
              <div
                key={principle.title}
                className="bg-white rounded-lg shadow-card p-6 hover:shadow-card-hover transition-shadow"
              >
                <div className="w-12 h-12 bg-pastel-blue rounded-lg mb-4 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-soft-black" />
                </div>
                <h3 className="font-display text-lg font-semibold text-soft-black mb-2">
                  {principle.title}
                </h3>
                <p className="font-body text-sm text-grey">
                  {principle.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Detailed Policy */}
        <div className="bg-white rounded-lg shadow-card p-8 md:p-12 space-y-8">
          {/* What We Collect */}
          <section>
            <h2 className="font-display text-2xl font-bold text-soft-black mb-4">
              What we collect
            </h2>
            <p className="font-body text-grey mb-4">
              When you use ReReel, we collect:
            </p>
            <ul className="font-body text-grey space-y-2 ml-4">
              <li>• Your photo/photostrip (the image you upload)</li>
              <li>• Your email address (to send your surprise email)</li>
              <li>• Your caption (the note you write for future you)</li>
              <li>• The date you choose (when to send the email)</li>
              <li>
                • Basic usage data (to improve our service, no tracking pixels)
              </li>
            </ul>
          </section>

          {/* How We Use It */}
          <section>
            <h2 className="font-display text-2xl font-bold text-soft-black mb-4">
              How we use your data
            </h2>
            <p className="font-body text-grey">
              We use your information for one purpose: to deliver your surprise
              email on the date you choose. That's it. No marketing. No
              analytics. No selling.
            </p>
          </section>

          {/* How Long We Keep It */}
          <section>
            <h2 className="font-display text-2xl font-bold text-soft-black mb-4">
              How long we keep it
            </h2>
            <div className="bg-warm-beige p-4 rounded-lg border border-mist-grey">
              <p className="font-body text-soft-black font-semibold mb-2">
                Your photo:
              </p>
              <p className="font-body text-grey mb-4">
                Stored only until we send your email. After delivery, your photo
                is permanently deleted.
              </p>

              <p className="font-body text-soft-black font-semibold mb-2">
                Your email & caption:
              </p>
              <p className="font-body text-grey mb-4">
                We keep minimal records for email delivery. You can request
                deletion anytime.
              </p>
            </div>
          </section>

          {/* Your Rights */}
          <section>
            <h2 className="font-display text-2xl font-bold text-soft-black mb-4">
              Your rights
            </h2>
            <p className="font-body text-grey mb-4">You can:</p>
            <ul className="font-body text-grey space-y-2 ml-4">
              <li>
                <strong>Delete your data anytime</strong> — Email us and we'll
                remove everything
              </li>
              <li>
                <strong>Request what we have</strong> — We'll send you all data
                we store on you
              </li>
              <li>
                <strong>Cancel a scheduled email</strong> — We'll delete it and
                the photo
              </li>
            </ul>
          </section>

          {/* Contact */}
          <section className="pt-4 border-t border-mist-grey">
            <h2 className="font-display text-2xl font-bold text-soft-black mb-4">
              Questions?
            </h2>
            <p className="font-body text-grey mb-4">
              Privacy matters. If you have any concerns or questions, reach out:
            </p>
            <a
              href="/contact"
              className="inline-block font-body font-semibold text-blush-pink hover:text-soft-black transition-colors"
            >
              Contact Page
            </a>
          </section>
        </div>

        {/* TL;DR Box */}
        <div className="mt-12 bg-pastel-blue bg-opacity-30 rounded-lg p-8 border-l-4 border-blush-pink">
          <h3 className="font-display text-xl font-bold text-soft-black mb-3">
            TL;DR
          </h3>
          <p className="font-body text-soft-black">
            Your photos are yours. We don't sell them. We don't train AI on
            them. We only store them long enough to send your surprise email.
            That's our entire privacy policy.
          </p>
        </div>

        {/* Last Updated */}
        <div className="mt-8 text-center">
          <p className="font-body text-sm text-grey">
            Last updated:{" "}
            {new Date().toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* Back Link */}
        <div className="mt-16 text-center">
          <a
            href="/"
            className="inline-block bg-blush-pink text-soft-black rounded-lg px-8 py-3 font-body font-semibold hover:shadow-lg transition-all hover:bg-yellow-cream"
          >
            Back to Upload
          </a>
        </div>
      </div>
    </div>
  );
}
