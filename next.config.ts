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
};

export default withNextIntl(nextConfig);
