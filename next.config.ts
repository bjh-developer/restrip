import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // Security headers including Content Security Policy
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com https://cdn.userjot.com https://*.clerk.accounts.dev https://challenges.cloudflare.com https://cdn.jsdelivr.net", // Cloudflare Turnstile CAPTCHA + image compression
              "style-src 'self' 'unsafe-inline'", // unsafe-inline needed for styled-jsx and Tailwind
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.vercel-analytics.com https://*.vercel-insights.com https://*.userjot.com https://*.clerk.accounts.dev https://*.clerk.dev https://clerk-telemetry.com https://cdn.jsdelivr.net",
              "worker-src 'self' blob:",
              "child-src 'self' blob:",
              "frame-src 'self' https://*.clerk.accounts.dev https://challenges.cloudflare.com", // Clerk UI + Cloudflare CAPTCHA
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
