/** Where the list of projects and what they claim comes from. The score and the ranking are ours. */
export const SOURCE = {
  name: "PortWatch VI",
  repo: "4lwayz/portwatch-vi",
  url: "https://github.com/4lwayz/portwatch-vi",
}

export const SITE = {
  name: "VIPortLive",
  description:
    "Live streams, progress and news from the community projects trying to run GTA VI on PC.",
  // Without a slash at the end, so paths can be added to it.
  url: (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000")
  ).replace(/\/+$/, ""),
  repo: "dazacode/portwatch-vi",
}
