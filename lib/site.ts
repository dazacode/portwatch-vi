export const SITE = {
  name: "VIPortLive",
  description:
    "Live streams, progress and news from the community projects trying to run GTA VI on PC.",
  url:
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000"),
  repo: "dazacode/portwatch-vi",
  upstream: "https://github.com/4lwayz/portwatch-vi",
}
