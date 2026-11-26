// The news page's "Everything" view: reports, articles, the press, code and the board on one
// timeline, a day at a time. Busy streams (stories, commits, pull requests) come as one row a day,
// so the quiet but important things are not buried under them.
import type { BoardEvent } from "@/lib/board"
import { type IntelItem, isVisible, KIND_LABEL } from "@/lib/intel"
import type { Story } from "@/lib/stories"
import type { ActivityCommit, NewsArticle, PullRequest, Tracker } from "@/lib/tracker"

export const SHOWS = ["all", "reports", "stories", "code", "board"] as const
export type Show = (typeof SHOWS)[number]

export type Kind = "report" | "held" | "article" | "press" | "code" | "joined" | "down" | "takedown"

/** A line under a rolled-up row. */
export type Sub = { title: string; href: string; external: boolean; meta: string }

export type Entry = {
  id: string
  kind: Kind
  /** The small label above the title. */
  label: string
  at: string
  projectId: string | null
  projectName: string | null
  title: string
  href: string
  external: boolean
  detail: string | null
  subs: Sub[]
}

export type Day = { day: string; entries: Entry[] }

type Sources = {
  intel: IntelItem[]
  articles: NewsArticle[]
  stories: Story[]
  commits: ActivityCommit[]
  pulls: PullRequest[]
  board: BoardEvent[]
  dmca: Tracker["dmca"]
  /** Project names by id, for code that only knows its id. */
  names: Map<string, string>
}

const dayOf = (iso: string) => iso.slice(0, 10)
const time = (iso: string) => Date.parse(iso)
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

/** Which tab an address asks for. Old story links (?q, ?topic, ?sort) still open the stories. */
export function parseShow(params: Record<string, string | string[] | undefined>): Show {
  const show = SHOWS.find((s) => s === params.show)
  if (show) return show
  return ["q", "topic", "category", "sort"].some((k) => params[k]) ? "stories" : "all"
}

function reportEntry(item: IntelItem): Entry {
  return {
    id: `intel:${item.id}`,
    kind: item.status === "held" ? "held" : "report",
    label: KIND_LABEL[item.kind] ?? item.kind,
    at: item.at,
    projectId: item.projectId,
    projectName: item.projectName,
    title: item.title,
    href: `/intelligence/${item.id}`,
    external: false,
    detail: item.oneLine,
    subs: [],
  }
}

function codeRows(commits: ActivityCommit[], pulls: PullRequest[], names: Map<string, string>) {
  type Group = {
    key: string
    projectId: string | null
    name: string
    repo: string
    c: ActivityCommit[]
    p: PullRequest[]
  }
  const days = new Map<string, Map<string, Group>>()
  const group = (x: ActivityCommit | PullRequest) => {
    const key = x.projectId ?? x.repo.toLowerCase()
    const byKey = days.get(dayOf(x.at)) ?? new Map<string, Group>()
    days.set(dayOf(x.at), byKey)
    const g = byKey.get(key) ?? {
      key,
      projectId: x.projectId,
      name: (x.projectId && names.get(x.projectId)) || x.repo,
      repo: x.repo,
      c: [],
      p: [],
    }
    byKey.set(key, g)
    return g
  }
  for (const c of commits) group(c).c.push(c)
  for (const p of pulls) group(p).p.push(p)

  return [...days].map(([day, byKey]): Entry => {
    const groups = [...byKey.values()].sort(
      (a, b) => b.c.length + b.p.length - (a.c.length + a.p.length)
    )
    const all = groups.flatMap((g) => [...g.c, ...g.p])
    const at = all.map((x) => x.at).sort((a, b) => time(b) - time(a))[0]
    const counts = [
      all.some((x) => "number" in x) &&
        plural(
          groups.reduce((n, g) => n + g.p.length, 0),
          "pull request"
        ),
      all.some((x) => !("number" in x)) &&
        plural(
          groups.reduce((n, g) => n + g.c.length, 0),
          "commit"
        ),
    ].filter(Boolean)
    const single = groups.length === 1 ? groups[0] : null
    return {
      id: `code:${day}`,
      kind: "code",
      label: "Code",
      at,
      projectId: single?.projectId ?? null,
      projectName: single?.name ?? null,
      title: single
        ? `${single.name}: ${counts.join(" and ")}`
        : `${counts.join(" and ")} across ${plural(groups.length, "repository")}`.replace(
            "repositorys",
            "repositories"
          ),
      href: "/news?show=code",
      external: false,
      detail: null,
      subs: single
        ? [...single.p, ...single.c]
            .sort((a, b) => time(b.at) - time(a.at))
            .slice(0, 4)
            .map((x) => ({
              title: "number" in x ? x.title : x.message,
              href: x.url,
              external: true,
              meta: "number" in x ? `#${x.number}, ${x.state}` : x.sha.slice(0, 7),
            }))
        : groups.slice(0, 5).map((g) => {
            const latest = [...g.p, ...g.c].sort((a, b) => time(b.at) - time(a.at))[0]
            return {
              title: g.name,
              href: g.projectId ? `/projects/${g.projectId}` : `https://github.com/${g.repo}`,
              external: !g.projectId,
              meta: [
                g.p.length && plural(g.p.length, "PR"),
                g.c.length && plural(g.c.length, "commit"),
                `latest: ${"number" in latest ? latest.title : latest.message}`,
              ]
                .filter(Boolean)
                .join(", "),
            }
          }),
    }
  })
}

function pressRows(stories: Story[]): Entry[] {
  const days = new Map<string, Story[]>()
  for (const s of stories) days.set(dayOf(s.date), [...(days.get(dayOf(s.date)) ?? []), s])
  return [...days].map(([day, list]) => {
    const top = [...list].sort((a, b) => b.weight - a.weight || time(b.date) - time(a.date))
    return {
      id: `press:${day}`,
      kind: "press",
      label: "Press",
      at: list.map((s) => s.date).sort((a, b) => time(b) - time(a))[0],
      projectId: null,
      projectName: null,
      title: `${plural(list.length, "story")} in the press and on social`.replace(
        "storys",
        "stories"
      ),
      href: "/news?show=stories",
      external: false,
      detail: null,
      subs: top.slice(0, 4).map((s) => ({
        title: s.title,
        href: s.url,
        external: true,
        meta: `${s.outlet}, ${s.topic}`,
      })),
    }
  })
}

/** Newest day first, newest entry first within it. With a project, only what is about it. */
export function timeline(src: Sources, project: string | null = null, days = 14): Day[] {
  const mine = <T extends { projectId: string | null }>(x: T) => !project || x.projectId === project
  const entries: Entry[] = [
    ...src.intel.filter(isVisible).filter(mine).map(reportEntry),
    ...(project
      ? []
      : src.articles.map(
          (a): Entry => ({
            id: `article:${a.id}`,
            kind: "article",
            label: a.category ? `Article · ${a.category}` : "Article",
            at: a.publishedAt ?? a.date,
            projectId: null,
            projectName: null,
            title: a.title,
            href: `/news/${a.id}`,
            external: false,
            detail: a.dek,
            subs: [],
          })
        )),
    ...(project ? [] : pressRows(src.stories)),
    ...codeRows(src.commits.filter(mine), src.pulls.filter(mine), src.names),
    ...src.board.filter(mine).map(
      (e): Entry => ({
        id: `board:${e.id}`,
        kind: e.kind === "joined" ? "joined" : "down",
        label: e.kind === "joined" ? "Joined" : e.kind === "down" ? "Down" : "Inactive",
        at: e.at,
        projectId: e.projectId,
        projectName: e.name,
        title: e.title,
        href: `/projects/${e.projectId}`,
        external: false,
        detail: e.detail,
        subs: [],
      })
    ),
    ...(project
      ? []
      : src.dmca
          .filter((d) => d.gta6)
          .map(
            (d): Entry => ({
              id: `dmca:${d.url}`,
              kind: "takedown",
              label: "Takedown",
              at: d.date,
              projectId: null,
              projectName: null,
              title: `Take-Two filed a DMCA notice${d.repoCount > 1 ? ` covering ${d.repoCount.toLocaleString("en")} repositories` : ""}`,
              href: d.url,
              external: true,
              detail: d.tracked.length ? `Names ${d.tracked.join(", ")}.` : null,
              subs: [],
            })
          )),
  ].filter((e) => Number.isFinite(time(e.at)))

  const byDay = new Map<string, Entry[]>()
  for (const e of entries) byDay.set(dayOf(e.at), [...(byDay.get(dayOf(e.at)) ?? []), e])
  return [...byDay]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, days)
    .map(([day, list]) => ({ day, entries: list.sort((a, b) => time(b.at) - time(a.at)) }))
}

/** "Today", "Yesterday" or the date, in UTC like every other date on the site. */
export function dayLabel(day: string, now: string) {
  const diff = Math.round((Date.parse(dayOf(now)) - Date.parse(day)) / 864e5)
  if (diff === 0) return "Today"
  if (diff === 1) return "Yesterday"
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(day))
}
