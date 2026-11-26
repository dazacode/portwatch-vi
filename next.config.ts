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

// The answer's own domain shows one page. Anything else there belongs to the main site.
const onAnswer = [{ type: "host" as const, value: "isgta6onpc.com" }]

const nextConfig: NextConfig = {
  // Scribbletune imports fs for writing MIDI files, which the soundtrack never does.
  turbopack: { resolveAlias: { fs: { browser: "./lib/music/no-fs.ts" } } },
  redirects: async () => [
    {
      source:
        "/:path((?!$|robots\\.txt$|sitemap\\.xml$|og\\.png$|icon\\.svg$|favicon\\.ico$|_next/|_vercel/).*)",
      has: onAnswer,
      destination: "https://viportlive.com/:path",
      permanent: false,
    },
    // News, reports and code are one page now. Their old addresses open the matching tab.
    { source: "/intelligence", destination: "/news?show=reports", permanent: true },
    { source: "/activity", destination: "/news?show=code", permanent: true },
    {
      source: "/pc-answer/:rest*",
      has: [{ type: "host", value: "viportlive.com" }],
      destination: "https://isgta6onpc.com/",
      permanent: false,
    },
  ],
  rewrites: async () => ({
    beforeFiles: [
      { source: "/", has: onAnswer, destination: "/pc-answer" },
      { source: "/robots.txt", has: onAnswer, destination: "/pc-answer/robots" },
      { source: "/sitemap.xml", has: onAnswer, destination: "/pc-answer/sitemap" },
      { source: "/og.png", has: onAnswer, destination: "/pc-answer/og" },
    ],
    afterFiles: [],
    fallback: [],
  }),
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
