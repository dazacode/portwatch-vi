/** Where the list of projects and what they claim comes from. The score and the ranking are ours. */
export const SOURCE = {
  name: "PortWatch VI",
  repo: "4lwayz/portwatch-vi",
  url: "https://github.com/4lwayz/portwatch-vi",
}

/** One page that answers the question, on a domain of its own. Served by /pc-answer. */
export const ANSWER = {
  name: "Is GTA 6 on PC?",
  host: "isgta6onpc.com",
  url: "https://isgta6onpc.com",
}

/** Google Tag Manager, which loads Google Analytics. Only in production, so our own testing isn't counted. */
const GTM = "GTM-T9TV6C5W"
export const GOOGLE_TAG =
  process.env.VERCEL_ENV === "production"
    ? {
        src: `https://www.googletagmanager.com/gtm.js?id=${GTM}`,
        start:
          "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());",
      }
    : null

// Vercel names the shortest production domain, and the answer's is as short as ours.
const production = process.env.VERCEL_PROJECT_PRODUCTION_URL
const host = production?.endsWith(ANSWER.host) ? "viportlive.com" : production

export const SITE = {
  name: "VIPortLive",
  description:
    "Live streams, progress and news from the community projects trying to run GTA VI on PC.",
  // Without a slash at the end, so paths can be added to it.
  url: (
    process.env.NEXT_PUBLIC_SITE_URL || (host ? `https://${host}` : "http://localhost:3000")
  ).replace(/\/+$/, ""),
  repo: "dazacode/portwatch-vi",
}
