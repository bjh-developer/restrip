import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ReStrip Privacy Policy",
  description:
    "At ReStrip, we value your privacy and are committed to protecting your personal information. This Privacy Policy outlines how we collect, use, and safeguard your data when you use our services. By using ReStrip, you agree to the terms of this policy.",
  alternates: {
    canonical: "https://restrip.vercel.app/privacy-policy",
  },
  openGraph: {
    title: "ReStrip Privacy Policy",
    description:
      "At ReStrip, we value your privacy and are committed to protecting your personal information. This Privacy Policy outlines how we collect, use, and safeguard your data when you use our services. By using ReStrip, you agree to the terms of this policy.",
    url: "https://restrip.vercel.app/privacy-policy",
    siteName: "ReStrip",
    images: [{ url: "https://restrip.vercel.app/og-image.jpg" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ReStrip Privacy Policy",
    description:
      "At ReStrip, we value your privacy and are committed to protecting your personal information. This Privacy Policy outlines how we collect, use, and safeguard your data when you use our services. By using ReStrip, you agree to the terms of this policy.",
    images: ["https://restrip.vercel.app/og-image.jpg"],
  },
};

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen">{children}</div>;
}
