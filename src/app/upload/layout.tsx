import type { Metadata } from "next";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "ReStrip Quick Send",
  description:
    "Upload your photo strips to ReStrip and receive them back in the future.",
  alternates: {
    canonical: "https://restrip.vercel.app/upload",
  },
  openGraph: {
    title: "ReStrip Quick Send",
    description:
      "Upload your photo strips to ReStrip and receive them back in the future.",
    url: "https://restrip.vercel.app/upload",
    siteName: "ReStrip",
    images: [{ url: "https://restrip.vercel.app/og-image.jpg" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ReStrip Quick Send",
    description:
      "Upload your photo strips to ReStrip and receive them back in the future.",
    images: ["https://restrip.vercel.app/og-image.jpg"],
  },
};

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = (await headers()).get("x-nonce") ?? "";

  return (
    <div className="min-h-screen">
      {/* Turnstile script is server-rendered with a nonce so that strict-dynamic
          in the CSP can propagate trust to all scripts Turnstile loads dynamically.
          Uses explicit render mode; the upload page sets window.__onTurnstileLoad
          before this script fires. */}
      <script
        nonce={nonce}
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__onTurnstileLoad"
        async
      />
      {children}
    </div>
  );
}
