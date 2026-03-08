import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up - ReStrip",
  description:
    "Create a ReStrip account to securely store and access your photo strips, manage your scrapbook, and enjoy personalized features.",
  alternates: {
    canonical: "https://www.restrip.app/sign-up",
  },
  openGraph: {
    title: "Sign Up - ReStrip",
    description:
      "Create a ReStrip account to securely store and access your photo strips, manage your scrapbook, and enjoy personalized features.",
    url: "https://www.restrip.app/sign-up",
    siteName: "ReStrip",
    images: [{ url: "https://www.restrip.app/og-image.jpg" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sign Up - ReStrip",
    description:
      "Create a ReStrip account to securely store and access your photo strips, manage your scrapbook, and enjoy personalized features.",
    images: ["https://www.restrip.app/og-image.jpg"],
  },
};

/** Whitelisted post-sign-up redirect paths */
const ALLOWED_REDIRECTS = new Set(["/new"]);

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string; prefill_token?: string }>;
}) {
  const params = await searchParams;
  // Only allow whitelisted redirect paths to prevent open redirect
  const baseRedirect = params.redirect_url && ALLOWED_REDIRECTS.has(params.redirect_url)
    ? params.redirect_url
    : undefined;

  // Append prefill_token to redirect URL so /new can fetch saved form data
  let redirectUrl = baseRedirect;
  if (baseRedirect && params.prefill_token && /^[a-f0-9]{64}$/.test(params.prefill_token)) {
    redirectUrl = `${baseRedirect}?prefill_token=${params.prefill_token}`;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-warm-beige via-blush-pink/20 to-yellow-cream flex items-center justify-center px-4">
      <SignUp
        {...(redirectUrl ? { forceRedirectUrl: redirectUrl } : {})}
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
