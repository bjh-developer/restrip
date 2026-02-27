import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ReStrip Contact Us",
  description:
    "Have questions, feedback, or just want to say hi? Reach out to the ReStrip team! We're here to help and would love to hear from you.",
  alternates: {
    canonical: "https://www.restrip.app/contact",
  },
  openGraph: {
    title: "ReStrip Contact Us",
    description:
      "Have questions, feedback, or just want to say hi? Reach out to the ReStrip team! We're here to help and would love to hear from you.",
    url: "https://www.restrip.app/contact",
    siteName: "ReStrip",
    images: [{ url: "https://www.restrip.app/og-image.jpg" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ReStrip Contact Us",
    description:
      "Have questions, feedback, or just want to say hi? Reach out to the ReStrip team! We're here to help and would love to hear from you.",
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
