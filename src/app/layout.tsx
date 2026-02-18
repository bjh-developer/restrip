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
  title: "ReStrip - Photo strips that come back to you",
  description:
    "ReStrip turns your photo booth strips into lasting digital memories. Scan, save and rediscover your favourite photo strip moments.",
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
          <meta property="og:image" content="https://www.restrip.app/og-image.jpg"></meta>
          <meta property="og:site_name" content="ReStrip"></meta>
          <meta property="og:title" content="ReStrip - Photo strips that come back to you"></meta>
          <meta property="og:description" content="ReStrip turns your photo booth strips into lasting digital memories. Scan, save and rediscover your favourite photo strip moments." />
          <meta property="og:url" content="https://www.restrip.app"></meta>
          <meta property="twitter:image" content="https://www.restrip.app/og-image.jpg"></meta>
          <meta property="twitter:title" content="ReStrip - Photo strips that come back to you"></meta>
          <meta property="twitter:description" content="ReStrip turns your photo booth strips into lasting digital memories. Scan, save and rediscover your favourite photo strip moments."></meta>
        </head>
        <script src="https://analytics.ahrefs.com/analytics.js" data-key="bvLONNN9gpGp6wB1c+Aakw" async></script>
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
