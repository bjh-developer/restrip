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
    "Transform your photo strip memories into digital treasures. A small memory that returns when you least expect it.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link rel="icon" href="/favicon.ico" sizes="any" />
          <meta
            name="google-site-verification"
            content="nO-YAzyQoB0NZ75BCn7gL3M8SK8u-hPG52ShKXrfshY"
          />
        </head>
        <body
          className={`${playfairDisplay.variable} ${inter.variable} ${caveat.variable} antialiased`}
        >
          {children}
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
