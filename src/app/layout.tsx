import type { Metadata } from "next";
import { Playfair_Display, Inter, Caveat } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
// @ts-ignore
import "../styles/globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const playfairDisplay = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const caveat = Caveat({
  variable: "--font-caption",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ReStrip - Photo booth strips that come back to you",
  description:
    "ReStrip turns your photo booth strips into lasting digital memories. Scan, save and rediscover your favourite photo strip moments.",
  alternates: {
    canonical: "https://www.restrip.app",
  },
  openGraph: {
    title: "ReStrip - Photo booth strips that come back to you",
    description:
      "ReStrip turns your photo booth strips into lasting digital memories. Scan, save and rediscover your favourite photo strip moments.",
    url: "https://www.restrip.app",
    siteName: "ReStrip",
    images: [{ url: "https://www.restrip.app/og-image.jpg" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ReStrip - Photo booth strips that come back to you",
    description:
      "ReStrip turns your photo booth strips into lasting digital memories. Scan, save and rediscover your favourite photo strip moments.",
    images: ["https://www.restrip.app/og-image.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="h-full">
        <head>
          <link rel="icon" href="/favicon.ico" sizes="any" />
          <meta
            name="google-site-verification"
            content="nO-YAzyQoB0NZ75BCn7gL3M8SK8u-hPG52ShKXrfshY"
          />
          <meta
            name="ahrefs-site-verification"
            content="1cb77938b8dbd9c71cb1ec1aa97e36430ebf1cf29bd2a917bb8f24a6f0b52bb0"
          ></meta>
          <script
            src="https://analytics.ahrefs.com/analytics.js"
            data-key="bvLONNN9gpGp6wB1c+Aakw"
            async
          ></script>
        </head>
        <body
          className={`${playfairDisplay.variable} ${inter.variable} ${caveat.variable} antialiased h-full`}
        >
          {children}
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
