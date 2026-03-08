import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In - ReStrip",
  description:
    "Sign in to your ReStrip account to view your photo strips, manage your scrapbook, and access exclusive features.",
  alternates: {
    canonical: "https://www.restrip.app/sign-in",
  },
  openGraph: {
    title: "Sign In - ReStrip",
    description:
      "Sign in to your ReStrip account to view your photo strips, manage your scrapbook, and access exclusive features.",
    url: "https://www.restrip.app/sign-in",
    siteName: "ReStrip",
    images: [{ url: "https://www.restrip.app/og-image.jpg" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sign In - ReStrip",
    description:
      "Sign in to your ReStrip account to view your photo strips, manage your scrapbook, and access exclusive features.",
    images: ["https://www.restrip.app/og-image.jpg"],
  },
};

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-warm-beige via-blush-pink/20 to-yellow-cream flex items-center justify-center px-4">
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-card rounded-2xl",
          },
        }}
      />
    </div>
  );
}
