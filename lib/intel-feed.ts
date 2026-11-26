import type { IntelFile, IntelItem } from "@/lib/intel"
import { published, reportOf, sourceCount } from "@/lib/intel"
import { pageUrl } from "@/lib/seo"
import { SITE } from "@/lib/site"

const MAX = 40

const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
}
const xml = (text: string) =>
  text
    // biome-ignore lint/suspicious/noControlCharactersInRegex: XML does not allow them
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "")
    .replace(/[&<>"']/g, (c) => ENTITIES[c])

const plain = (file: IntelFile, item: IntelItem) => {
  const report = reportOf(file, item)
  const sources = `Sources: ${item.sources.map((s) => `${s.outlet}: ${s.title}`).join(" · ")}`
  if (!report) return `${item.oneLine}\n\n${sources}`
  return [
    report.overview,
    report.changed,
    `Supporting evidence: ${report.evidence}`,
    `What remains unknown: ${report.unknown}`,
    sources,
  ].join("\n\n")
}

export function intelFeed(file: IntelFile) {
  const items = published(file).slice(0, MAX)
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "<channel>",
    `<title>${xml(SITE.name)}: Intelligence</title>`,
    `<link>${xml(pageUrl("/intelligence"))}</link>`,
    `<atom:link href="${xml(pageUrl("/intelligence/feed.xml"))}" rel="self" type="application/rss+xml"/>`,
    "<description>Automated reports on changes to the public GTA VI PC build record, with sources and confidence. Unofficial.</description>",
    "<language>en</language>",
    ...(items[0] ? [`<lastBuildDate>${new Date(items[0].at).toUTCString()}</lastBuildDate>`] : []),
    ...items.map((item) =>
      [
        "<item>",
        `<title>${xml(item.title)}</title>`,
        `<link>${xml(pageUrl(`/intelligence/${item.id}`))}</link>`,
        `<guid isPermaLink="false">${xml(`intel:${item.id}`)}</guid>`,
        `<pubDate>${new Date(item.at).toUTCString()}</pubDate>`,
        `<category>${xml(item.kind)}</category>`,
        `<description>${xml(`${plain(file, item)} (${sourceCount(item)} sources; ${item.confidence?.bucket} confidence)`)}</description>`,
        "</item>",
      ].join("")
    ),
    "</channel>",
    "</rss>",
  ].join("\n")
}

export function jsonFeed(file: IntelFile) {
  return {
    version: "https://jsonfeed.org/version/1.1",
    title: `${SITE.name}: Intelligence`,
    home_page_url: pageUrl("/intelligence"),
    feed_url: pageUrl("/intelligence/feed.json"),
    description: "Automated reports on the GTA VI PC build record. Unofficial.",
    language: "en",
    items: published(file)
      .slice(0, MAX)
      .map((item) => ({
        id: item.id,
        url: pageUrl(`/intelligence/${item.id}`),
        title: item.title,
        content_text: plain(file, item),
        summary: item.oneLine,
        date_published: item.at,
        tags: [item.kind, item.confidence?.bucket].filter(Boolean),
        _viportlive: {
          confidence: item.confidence?.bucket,
          sources: sourceCount(item),
          status: item.status,
          project: item.projectId,
        },
      })),
  }
}
