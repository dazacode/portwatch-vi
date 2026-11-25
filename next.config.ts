import type { NextConfig } from "next"

const headers = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // YouTube's player needs the origin as referrer.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Content-Security-Policy",
    value:
      "frame-src https://player.twitch.tv https://www.youtube-nocookie.com https://player.kick.com; frame-ancestors 'self'; object-src 'none'; base-uri 'self'",
  },
]

const nextConfig: NextConfig = {
  headers: async () => [{ source: "/:path*", headers }],
}

export default nextConfig
