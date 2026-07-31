import type { NextConfig } from "next";

function supabaseHostname(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://efgmjuzcqolpibraymol.supabase.co";
  try {
    return new URL(url).hostname;
  } catch {
    return "efgmjuzcqolpibraymol.supabase.co";
  }
}

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

export default nextConfig;
