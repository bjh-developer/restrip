import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ReStrip Quick Send",
  description:
    "Upload your photo strips to ReStrip and receive them back in the future.",
  alternates: {
    canonical: "https://www.restrip.app/upload",
  },
  openGraph: {
    title: "ReStrip Quick Send",
    description:
      "Upload your photo strips to ReStrip and receive them back in the future.",
    url: "https://www.restrip.app/upload",
    siteName: "ReStrip",
    images: [{ url: "https://www.restrip.app/og-image.jpg" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ReStrip Quick Send",
    description:
      "Upload your photo strips to ReStrip and receive them back in the future.",
    images: ["https://www.restrip.app/og-image.jpg"],
  },
};

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen">{children}</div>;
}
