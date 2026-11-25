import type { BoardEvent } from "@/lib/board"
import { isHidden } from "@/lib/hide"
import { FEED, pageUrl } from "@/lib/seo"
import { SITE } from "@/lib/site"
import type { NewsArticle } from "@/lib/tracker"

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

type Item = { id: string; title: string; path: string; text: string; category: string; at: string }

/** This site's own articles, and projects that joined the board or left it. Newest first. */
export function feedXml(news: NewsArticle[], board: BoardEvent[]) {
  const items: Item[] = [
    ...news.map((n) => ({
      id: `news:${n.id}`,
      title: n.title,
      path: `/news/${n.id}`,
      text: n.dek,
      category: n.category,
      at: n.date,
    })),
    ...board.map((e) => ({
      id: `board:${e.id}:${e.at.slice(0, 10)}`,
      title: e.title,
      path: `/projects/${e.projectId}`,
      text: e.detail,
      category: "Board",
      at: e.at,
    })),
  ]
  const shown = items
    .filter((i) => Number.isFinite(Date.parse(i.at)) && !isHidden(i))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, MAX)
  const date = (iso: string) => new Date(iso).toUTCString()
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "<channel>",
    `<title>${xml(SITE.name)}</title>`,
    `<link>${xml(pageUrl("/news"))}</link>`,
    `<atom:link href="${xml(pageUrl(FEED))}" rel="self" type="application/rss+xml"/>`,
    "<description>Articles about running GTA VI on PC, and projects that join or leave the board. Unofficial.</description>",
    "<language>en</language>",
    ...(shown[0] ? [`<lastBuildDate>${date(shown[0].at)}</lastBuildDate>`] : []),
    ...shown.map((i) =>
      [
        "<item>",
        `<title>${xml(i.title)}</title>`,
        `<link>${xml(pageUrl(i.path))}</link>`,
        `<guid isPermaLink="false">${xml(i.id)}</guid>`,
        `<pubDate>${date(i.at)}</pubDate>`,
        `<category>${xml(i.category)}</category>`,
        `<description>${xml(i.text)}</description>`,
        "</item>",
      ].join("")
    ),
    "</channel>",
    "</rss>",
  ].join("\n")
}
