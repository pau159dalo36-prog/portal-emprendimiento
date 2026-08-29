import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

function supabaseHostname(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://efgmjuzcqolpibraymol.supabase.co";
  try {
    return new URL(url).hostname;
  } catch {
    return "efgmjuzcqolpibraymol.supabase.co";
  }
}

function securityHeaders(): Array<{ key: string; value: string }> {
  return [
    { key: "X-DNS-Prefetch-Control", value: "on" },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    },
    {
      key: "Content-Security-Policy",
      value: [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://*.supabase.co",
        "media-src 'self' blob: https://*.supabase.co",
        "connect-src 'self' ws: wss:",
        "font-src 'self' data:",
        "frame-ancestors 'self'",
        "form-action 'self'",
        "base-uri 'self'",
        "object-src 'none'",
      ].join("; "),
    },
  ];
}

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHostname(),
      },
    ],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(),
      },
      {
        source: "/",
        headers: securityHeaders(),
      },
    ];
  },
};

export default withNextIntl(nextConfig);
