import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { describe, expect, it } from "vitest"
import manifest from "@/app/manifest"
import robots from "@/app/robots"
import sitemap from "@/app/sitemap"
import { getBoard } from "@/lib/board"
import { feedXml } from "@/lib/feed"
import { isHidden } from "@/lib/hide"
import { getIntel, published } from "@/lib/intel"
import {
  articleLd,
  articleMeta,
  breadcrumbLd,
  clip,
  HOME,
  PAGES,
  pageMeta,
  projectMeta,
  standingsLd,
  standingsMeta,
  toJsonLd,
  websiteLd,
} from "@/lib/seo"
import { SITE } from "@/lib/site"
import { sitemapEntries } from "@/lib/sitemap"
import { getProjects } from "@/lib/standings"
import {
  getActivity,
  getEvidence,
  getMilestones,
  getRecords,
  getStandings,
  getTracker,
} from "@/lib/tracker"

const root = resolve(import.meta.dirname, "..")
const tracker = await getTracker()
const standings = getStandings(tracker, await getEvidence())
const projects = getProjects(standings, {
  tracker: await getRecords(),
  activity: await getActivity(),
  milestones: await getMilestones(),
  evidence: await getEvidence(),
})
const pages = [
  { ...HOME, path: "/" },
  standingsMeta(tracker.efforts.length),
  ...Object.values(PAGES),
  { title: "Intelligence queue", description: "Held discoveries.", path: "/intelligence/queue" },
  ...published(await getIntel()).map((i) => ({
    title: i.title,
    description: i.oneLine,
    path: `/intelligence/${i.id}`,
  })),
  ...standings.map(projectMeta),
  ...tracker.news.map(articleMeta),
]

describe("titles and descriptions", () => {
  it("are there, differ, and describe an unofficial tracker", () => {
    for (const key of ["title", "description", "path"] as const) {
      expect(new Set(pages.map((p) => p[key])).size).toBe(pages.length)
      for (const p of pages) expect(p[key]).toBeTruthy()
    }
    expect(HOME.description).toContain("unofficial")
    for (const p of standings.map(projectMeta)) expect(p.description.length).toBeLessThan(202)
  })

  it("name nothing that is hidden", () => {
    for (const p of pages) expect(isHidden(p), p.path).toBe(false)
  })

  it("point every variant of a page at its plain path", () => {
    for (const p of pages) {
      const meta = pageMeta(p)
      expect(meta.alternates?.canonical).toBe(p.path)
      expect(p.path).not.toContain("?")
      expect(meta.openGraph).toMatchObject({ url: p.path, title: p.title })
      expect(meta.twitter).toMatchObject({ card: "summary_large_image" })
    }
  })

  it("cuts at a word", () => {
    expect(clip("one two three", 9)).toBe("one two…")
    expect(clip("one  two", 9)).toBe("one two")
  })
})

describe("sitemap and robots", () => {
  it("lists every page once and nothing else", async () => {
    const urls = (await sitemap()).map((e) => e.url)
    expect(urls).toEqual([...new Set(urls)])
    const path = (url: string) => url.slice(SITE.url.length) || "/"
    expect(urls.map(path).sort()).toEqual(
      pages
        .filter((p) => p.path !== "/intelligence/queue")
        .map((p) => p.path)
        .sort()
    )
    expect(isHidden(urls)).toBe(false)
    for (const url of urls) expect(url.startsWith(SITE.url)).toBe(true)
  })

  it("has every route of the app", () => {
    const routes: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const file = join(dir, name)
        if (statSync(file).isDirectory()) walk(file)
        else if (name === "page.tsx") routes.push(`/${relative(join(root, "app"), dir)}`)
      }
    }
    walk(join(root, "app"))
    for (const route of routes) {
      const like = new RegExp(`^${route.replace(/\[\w+\]/g, "[\\w-]+")}$`)
      expect(
        pages.some((p) => like.test(p.path)),
        route
      ).toBe(true)
    }
  })

  it("dates a page by its own data, and leaves the date out without any", () => {
    const at = "2026-11-24T10:00:00Z"
    const entries = sitemapEntries(
      {
        tracker: { ...tracker, efforts: tracker.efforts.slice(0, 2), news: [] },
        news: { updated: null },
        activity: { updated: at, projects: {} },
        milestones: [
          { id: tracker.efforts[0].id, at },
          { id: tracker.efforts[0].id, at: "2999-01-01T00:00:00Z" },
        ],
        evidence: [],
      },
      Date.parse("2026-11-25T00:00:00Z")
    )
    const of = (path: string) => entries.find((e) => e.url === SITE.url + path)
    expect(of(`/projects/${tracker.efforts[0].id}`)?.lastModified).toBe(at)
    expect(of("/news")?.lastModified).toBe(at)
    expect(of("/method")).not.toHaveProperty("lastModified")
    expect(of("/verify")).not.toHaveProperty("lastModified")
  })

  it("lets crawlers in and shows them the sitemap", () => {
    expect(robots()).toEqual({
      rules: { userAgent: "*", allow: "/" },
      sitemap: `${SITE.url}/sitemap.xml`,
    })
  })

  it("has icons that exist", () => {
    for (const icon of manifest().icons ?? []) {
      expect(statSync(join(root, "public", icon.src)).size).toBeGreaterThan(0)
    }
  })
})

describe("structured data", () => {
  const all = [
    websiteLd(),
    standingsLd(projects),
    ...tracker.news.map(articleLd),
    ...standings.map((s) => breadcrumbLd([{ name: s.name, path: `/projects/${s.id}` }])),
  ]

  it("can't close its script, and stays the same data", () => {
    const text = toJsonLd({ name: "</script><script>alert(1)</script><!--" })
    expect(text).not.toContain("<")
    expect(JSON.parse(text).name).toBe("</script><script>alert(1)</script><!--")
  })

  it("names nothing hidden and invents no people, ratings or images", () => {
    for (const data of all) {
      expect(isHidden(data)).toBe(false)
      expect(JSON.stringify(data)).not.toMatch(
        /"(author|publisher|aggregateRating|review|image|dateModified)"/
      )
    }
  })

  it("dates an article by its record", () => {
    for (const a of tracker.news) {
      expect(articleLd(a)).toMatchObject({ headline: a.title, datePublished: a.date })
    }
  })

  it("lists ranked projects in order", () => {
    const list = standingsLd(projects).itemListElement
    expect(list.length).toBeGreaterThan(0)
    expect(list.map((i) => i.position)).toEqual(list.map((_, i) => i + 1))
  })
})

describe("feed", () => {
  it("has the articles and the board, and nothing hidden", async () => {
    const board = await getBoard()
    const feed = feedXml(tracker.news, board)
    expect(isHidden(feed)).toBe(false)
    expect(feed).toContain(`${SITE.url}/news/${tracker.news[0].id}</link>`)
    if (board[0]) expect(feed).toContain("<category>Board</category>")
    expect(feed.match(/<item>/g)?.length).toBeLessThanOrEqual(40)
  })

  it("escapes text and drops what XML can't hold", () => {
    const [a] = tracker.news
    const feed = feedXml([{ ...a, title: "A & B <script>\u0000", date: "2026-11-24" }], [])
    expect(feed).toContain("<title>A &amp; B &lt;script&gt;</title>")
    expect(feed).toContain("<pubDate>Tue, 24 Nov 2026 00:00:00 GMT</pubDate>")
  })

  it("leaves out anything that names the hidden project", () => {
    const [a] = tracker.news
    expect(feedXml([{ ...a, dek: "PortWatch says so" }], [])).not.toContain("<item>")
  })
})

// The data files are large, and as written they name what the site hides.
describe("what the browser downloads", () => {
  const IMPORT =
    /^(?:import|export)\s+(?!type\b)[^"']*?["']([^"']+)["']|import\(["']([^"']+)["']\)/gm
  const find = (from: string, spec: string) => {
    const base = spec.startsWith("@/")
      ? join(root, spec.slice(2))
      : spec.startsWith(".")
        ? resolve(dirname(from), spec)
        : null
    if (!base) return null
    return [base, `${base}.ts`, `${base}.tsx`].find(
      (f) => statSync(f, { throwIfNoEntry: false })?.isFile() === true
    )
  }

  it("never includes the data files", () => {
    const files: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const file = join(dir, name)
        if (statSync(file).isDirectory()) walk(file)
        else if (/\.tsx?$/.test(name)) files.push(file)
      }
    }
    walk(join(root, "components"))
    walk(join(root, "app"))
    const queue = files.filter((f) => /^"use client"/.test(readFileSync(f, "utf8")))
    expect(queue.length).toBeGreaterThan(10)
    const seen = new Set<string>(queue)
    for (const file of queue) {
      for (const [, a, b] of readFileSync(file, "utf8").matchAll(IMPORT)) {
        const next = find(file, a ?? b)
        if (!next || seen.has(next)) continue
        expect(next, relative(root, file)).not.toMatch(/\/data\/[\w-]+\.json$/)
        seen.add(next)
        if (/\.(tsx?|mjs)$/.test(next)) queue.push(next)
      }
    }
  })
})
