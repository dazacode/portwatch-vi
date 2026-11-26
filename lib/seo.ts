import type { Metadata } from "next"
import { utcDay } from "@/lib/format"
import { SITE } from "@/lib/site"
import type { Project } from "@/lib/standings"
import type { NewsArticle, Standing } from "@/lib/tracker"

export const FEED = "/feed.xml"

export const pageUrl = (path: string) => SITE.url + (path === "/" ? "" : path)

/** Cut at a word, for descriptions. */
export function clip(text: string, max: number) {
  const plain = text.replace(/\s+/g, " ").trim()
  if (plain.length <= max) return plain
  return `${plain.slice(0, max).replace(/[\s,.;:]+\S*$/, "")}…`
}

/** Everything a page says about itself. The address is the plain path, whatever is filtered or open. */
export function pageMeta({
  title,
  description,
  path,
  published,
}: {
  title: string
  description: string
  path: string
  /** Makes it an article. */
  published?: string
}): Metadata {
  return {
    title: path === "/" ? { absolute: title } : title,
    description,
    alternates: {
      canonical: path,
      types: { "application/rss+xml": [{ url: FEED, title: `${SITE.name}: articles and board` }] },
    },
    openGraph: {
      ...(published ? { type: "article", publishedTime: published } : { type: "website" }),
      siteName: SITE.name,
      url: path,
      title,
      description,
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE] },
  }
}

const OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: `${SITE.name}: ${SITE.description}`,
}

export const HOME = {
  title: `${SITE.name}: does GTA VI run on PC yet?`,
  description:
    "An unofficial tracker of the community projects trying to run GTA VI on PC: live streams, standings, commits and news. It hosts no game files.",
}

export const standingsMeta = (projects: number) => ({
  title: "Standings of every GTA VI PC port",
  description: `${projects} community projects trying to run GTA VI on PC, scored by what they claim and how much of it independent people have seen.`,
  path: "/standings",
})

export const PAGES = {
  news: {
    title: "News about running GTA VI on PC",
    description:
      "Public stories about the community projects trying to run GTA VI on PC, from takedowns to milestones. Gathered every half hour and linked to where they were written.",
    path: "/news",
  },
  activity: {
    title: "Commits and pull requests of GTA VI PC ports",
    description:
      "Public commits and pull requests from the projects trying to run GTA VI on PC, read from GitHub every half hour, and new repositories as they are found.",
    path: "/activity",
  },
  intelligence: {
    title: "Intelligence: GTA VI PC build discoveries",
    description:
      "Automated reports on new GTA VI PC build references, test reports and takedowns, with sources, timestamps and confidence. Unofficial.",
    path: "/intelligence",
  },
  verify: {
    title: "Prove a GTA VI PC run live",
    description:
      "How a project shows that its GTA VI build really runs on PC: a code and three in-game actions, done on a recorded stream and watched by a person.",
    path: "/verify",
  },
  method: {
    title: "How GTA VI PC ports are scored",
    description:
      "What each score means, how claims are checked by independent testers and live challenges, how streams are found, and the fakes to avoid.",
    path: "/method",
  },
  top20: {
    title: "GTA VI on PC: the top 20 builds",
    description:
      "How far GTA VI runs on PC, all fan builds combined, and the top 20 by our score. Updated with the board.",
    path: "/top-20",
  },
}

export function projectMeta(s: Standing) {
  const status = s.nuked
    ? `Taken offline on ${utcDay(s.nuked)}. Last claim`
    : s.isPrivate
      ? "A private build. Claims"
      : "Claims"
  return {
    title: `${s.name}: progress running GTA VI on PC`,
    description: clip(
      `${status} “${s.stage}” at ${s.score}%, scores ${s.rating}%. ${s.summary}`,
      200
    ),
    path: `/projects/${s.id}`,
  }
}

export const articleMeta = (a: NewsArticle) => ({
  title: a.title,
  description: a.dek,
  path: `/news/${a.id}`,
  published: a.date,
})

/* ---------- Structured data: only what the page itself shows ---------- */

/** "<" is the only character that could end the script element. */
export const toJsonLd = (data: object) =>
  JSON.stringify({ "@context": "https://schema.org", ...data }).replace(/</g, "\\u003c")

export const websiteLd = () => ({
  "@type": "WebSite",
  name: SITE.name,
  url: pageUrl("/"),
  description: HOME.description,
  inLanguage: "en",
})

/** The trail shown above a page's title. The last step is the page itself. */
export const breadcrumbLd = (steps: { name: string; path: string }[]) => ({
  "@type": "BreadcrumbList",
  itemListElement: steps.map(({ name, path }, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name,
    item: pageUrl(path),
  })),
})

/** No author or publisher: neither is on record. */
export const articleLd = (a: NewsArticle) => ({
  "@type": "NewsArticle",
  headline: a.title,
  description: a.dek,
  articleSection: a.category,
  datePublished: a.date,
  inLanguage: "en",
  mainEntityOfPage: pageUrl(`/news/${a.id}`),
  ...(a.sources.length > 0 && {
    citation: a.sources.map((s) => ({ "@type": "CreativeWork", name: s.title, url: s.url })),
  }),
})

/** The race: ranked projects only, in the order shown. */
export const standingsLd = (projects: Pick<Project, "id" | "name" | "rank">[]) => ({
  "@type": "ItemList",
  name: "Standings of the projects trying to run GTA VI on PC",
  itemListElement: projects
    .filter((p) => p.rank !== null)
    .map((p) => ({
      "@type": "ListItem",
      position: p.rank,
      name: p.name,
      url: pageUrl(`/projects/${p.id}`),
    })),
})
