import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // Non-CSP security headers — CSP is handled in middleware.ts with per-request
  // nonces. Serving it here as a static header would break nonce enforcement.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
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
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // Override Vercel's auto-generated report-only CSP (which defaults to
          // 'script-src none' when it can't statically detect nonce-bearing scripts).
          // Setting an empty report-only policy suppresses the false-positive console
          // noise; enforcement is handled entirely by our nonce-based CSP in proxy.ts.
          {
            key: "Content-Security-Policy-Report-Only",
            value: "",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
