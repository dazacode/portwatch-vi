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

const cache = (days: number) => [
  {
    key: "Cache-Control",
    value: `public, max-age=${days * 86400}, stale-while-revalidate=86400`,
  },
]

const nextConfig: NextConfig = {
  headers: async () => [
    { source: "/:path*", headers },
    // Data for the pages, not pages.
    { source: "/api/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
    // Their names carry no hash, so a replaced clip needs a new name.
    { source: "/video/:path*", headers: cache(30) },
    { source: "/icons/:path*", headers: cache(30) },
  ],
}

export default nextConfig
