import type { NextConfig } from "next";

/**
 * Production-safe baseline security headers applied to every route.
 *
 * Content-Security-Policy is intentionally DEFERRED for this slice. A correct
 * CSP must allow Next.js runtime (inline/hydration scripts), Supabase auth and
 * assets, Stripe checkout/payment flows, and API/email callbacks. Shipping a
 * fragile CSP now risks breaking those flows in production, so it is tracked as
 * follow-up work rather than added here.
 */
const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    // Production is served over HTTPS; this is a no-op on plain HTTP (dev),
    // so it is safe to send unconditionally.
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
] as const;

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...securityHeaders],
      },
    ];
  },
};

export default nextConfig;
