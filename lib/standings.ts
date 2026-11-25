import { utcDay } from "@/lib/format"
import type { Milestone } from "@/lib/milestones"
import { MILESTONES } from "@/lib/scoring.mjs"
import type { Activity, Effort, Evidence, Standing, Tracker } from "@/lib/tracker"

/** A repo with nothing new for longer than this is inactive. The same window as the commit count. */
export const INACTIVE_DAYS = 7

export type Status = "active" | "inactive" | "offline" | "private" | "unknown"

export const STATUS_LABEL: Record<Status, string> = {
  active: "Active",
  inactive: "Inactive",
  offline: "Offline",
  private: "Private build",
  unknown: "Unclear",
}

export const STATUSES = Object.keys(STATUS_LABEL) as Status[]
export const STAGES: { key: string; label: string }[] = MILESTONES

/** Where a project's first date comes from. There is no third kind: without either it is unknown. */
export type Origin = { at: string; kind: "github" | "mentioned" }
export type LastCode = { at: string; kind: "push" | "commit" }

export const ORIGIN_LABEL: Record<Origin["kind"], string> = {
  github: "On GitHub since",
  mentioned: "First mentioned",
}

/** The part of a project the filters read. Small enough to send to the browser. */
export type Entry = Pick<
  Standing,
  "id" | "name" | "claimedStage" | "isPrivate" | "rating" | "score" | "stars" | "commits7d"
> & {
  repo: string | null
  /** Place among projects that are not offline or inactive. Null is not ranked: a private build, unless they are ranked too. */
  rank: number | null
  status: Status
  origin: Origin | null
}

export type Project = Standing &
  Entry & {
    lastCode: LastCode | null
    /** Private for now, with a promise to publish the code once the build is out. */
    publicLater: boolean
    /** Why it is in its group, when that needs saying. */
    reason: string | null
    /** Why we placed it first ourselves, where we did. */
    pick: string | null
  }

type Sources = {
  tracker: Pick<Tracker, "efforts" | "changes" | "news" | "scout" | "pick">
  activity: Pick<Activity, "updated" | "projects">
  milestones: Pick<Milestone, "id" | "at">[]
  evidence: Pick<Evidence, "effortId" | "at">[]
}

const DAY = 864e5
const time = (iso: string | null | undefined) => (iso ? Date.parse(iso) : Number.NaN)
const isDate = (iso: string | null | undefined): iso is string => Number.isFinite(time(iso))
const day = (iso: string) => new Date(iso).toISOString().slice(0, 10)
const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const pick = (dates: (string | null | undefined)[], newest: boolean) =>
  dates
    .filter(isDate)
    .sort((a, b) => (newest ? time(b) - time(a) : time(a) - time(b)))
    .at(0) ?? null

/** Whole names only, so "omonkey" is not found inside "omonkeyz/xbox-emulator". */
function mentions({ name, repo }: Pick<Effort, "name" | "repo">) {
  const patterns = [new RegExp(`(?<![\\w/-])${literal(name)}(?![\\w/-])`)]
  if (repo) patterns.push(new RegExp(`(?<![\\w./-])${literal(repo)}(?![\\w-])`, "i"))
  return (text: string) => patterns.some((p) => p.test(text))
}

/** When the repo was created, or else the first time the tracker's own records name the project. */
export function getOrigin(effort: Effort, sources: Sources): Origin | null {
  if (isDate(effort.stats.createdAt)) return { at: effort.stats.createdAt, kind: "github" }
  const named = mentions(effort)
  const { tracker, milestones, evidence } = sources
  const at = pick(
    [
      ...tracker.changes.filter((c) => named(c.text)).map((c) => c.date),
      ...tracker.news
        .filter((n) => named([n.title, n.dek, ...n.body].join("\n")))
        .map((n) => n.date),
      ...milestones.filter((m) => m.id === effort.id).map((m) => m.at),
      ...evidence.filter((e) => e.effortId === effort.id).map((e) => e.at),
    ],
    false
  )
  return at ? { at, kind: "mentioned" } : null
}

function newestCommit(effort: Effort, { activity }: Sources) {
  // Commit dates are set by whoever commits, so one from after the harvest can't be right.
  const until = time(activity.updated)
  const commits = activity.projects[effort.id]?.commits ?? []
  return pick(
    commits.map((c) => c.at).filter((at) => !(time(at) > until)),
    true
  )
}

export function getLastCode(effort: Effort, sources: Sources): LastCode | null {
  const pushed = effort.stats.pushedAt
  const commit = newestCommit(effort, sources)
  if (isDate(pushed) && !(time(commit) > time(pushed))) return { at: pushed, kind: "push" }
  return commit ? { at: commit, kind: "commit" } : null
}

export function getStatus(
  effort: Effort,
  isPrivate: boolean,
  sources: Sources
): { status: Status; reason: string | null } {
  const { stats, nuked } = effort
  if (nuked) {
    const reason = isDate(nuked.at) ? `Taken offline on ${utcDay(nuked.at)}` : "Taken offline"
    return { status: "offline", reason }
  }
  if (isPrivate) return { status: "private", reason: "Private build" }
  // The scout that set the flag is also the clock, so a stalled scout makes nobody inactive.
  const checked = sources.tracker.scout.lastRun
  if (stats.missing) {
    const on = isDate(checked) ? ` on ${utcDay(checked)}` : ""
    const answer = `Repo not reachable: GitHub answered ${stats.missingStatus ?? "an error"}${on}`
    return time(newestCommit(effort, sources)) > time(checked)
      ? { status: "unknown", reason: `${answer}, but newer commits were seen. To be checked again` }
      : { status: "offline", reason: answer }
  }
  if (stats.archived) return { status: "inactive", reason: "Archived on GitHub" }
  const last = getLastCode(effort, sources)
  if (!last || !isDate(checked)) return { status: "unknown", reason: "No activity recorded yet" }
  return time(checked) - time(last.at) > INACTIVE_DAYS * DAY
    ? { status: "inactive", reason: `Nothing new since ${utcDay(last.at)}` }
    : { status: "active", reason: null }
}

/** How many people outside the project have reported on it. */
export const reporters = (checks: { people: number }[]) =>
  checks.reduce((most, c) => Math.max(most, c.people), 0)

export const isGone = ({ status }: Pick<Entry, "status">) =>
  status === "offline" || status === "inactive"

/** Ranked, then private, then offline or inactive. Each part keeps the order of getStandings. */
export function getProjects(
  standings: Standing[],
  sources: Sources,
  { withPrivate = false }: { withPrivate?: boolean } = {}
): Project[] {
  const efforts = new Map(sources.tracker.efforts.map((e) => [e.id, e]))
  const projects = standings.flatMap((s): Project[] => {
    const effort = efforts.get(s.id)
    if (!effort) return []
    return [
      {
        ...s,
        ...getStatus(effort, s.isPrivate, sources),
        repo: effort.repo,
        rank: null,
        pick: null,
        publicLater: effort.publicLater ?? false,
        origin: getOrigin(effort, sources),
        lastCode: getLastCode(effort, sources),
      },
    ]
  })
  const gone = projects.filter(isGone)
  const isClosed = (p: Project) => p.status === "private" && !withPrivate
  const closed = projects.filter(isClosed)
  const ranked = projects.filter((p) => !isGone(p) && !isClosed(p))
  // Our own call, never hidden: the score stays what it is and the reason is shown next to it.
  const { pick } = sources.tracker
  const at = withPrivate && pick ? ranked.findIndex((p) => p.id === pick.id) : -1
  if (pick && at >= 0) ranked.unshift({ ...ranked.splice(at, 1)[0], pick: pick.reason })
  return [...ranked.map((p, i) => ({ ...p, rank: i + 1 })), ...closed, ...gone]
}

export function groupProjects(projects: Project[]) {
  const ranks = (from: number, to: number) =>
    projects.filter((p) => p.rank !== null && p.rank >= from && p.rank <= to)
  return {
    podium: ranks(1, 3),
    top5: ranks(4, 5),
    top10: ranks(6, 10),
    rest: ranks(11, Number.POSITIVE_INFINITY),
    private: projects.filter((p) => p.status === "private" && p.rank === null),
    gone: projects.filter(isGone),
  }
}

export const toEntry = (p: Project): Entry => ({
  id: p.id,
  name: p.name,
  repo: p.repo,
  claimedStage: p.claimedStage,
  isPrivate: p.isPrivate,
  status: p.status,
  rank: p.rank,
  rating: p.rating,
  score: p.score,
  stars: p.stars,
  commits7d: p.commits7d,
  origin: p.origin,
})

export const SORTS = {
  rank: "Rank",
  claimed: "Claimed",
  stars: "Stars",
  commits: "Commits, 7 days",
  newest: "Newest first",
  oldest: "Oldest first",
} as const

export type Sort = keyof typeof SORTS
export type Code = "all" | "public" | "private"
/** Who gets a rank. Private builds only on request: their code can’t be checked. */
export type Ranks = "public" | "everyone"
export type Filters = {
  q: string
  stage: string
  status: Status | "all"
  code: Code
  sort: Sort
  ranks: Ranks
}

export const NO_FILTERS: Filters = {
  q: "",
  stage: "all",
  status: "all",
  code: "all",
  sort: "rank",
  ranks: "public",
}
export const MAX_QUERY = 60

const oneOf = <T extends string>(value: string | null, allowed: readonly T[], fallback: T) =>
  allowed.find((a) => a === value) ?? fallback

/** Anything the page doesn't know falls back to the default, so an old link still opens. */
export const parseFilters = (params: Pick<URLSearchParams, "get">): Filters => ({
  q: (params.get("q") ?? "").slice(0, MAX_QUERY),
  stage: oneOf(
    params.get("stage"),
    STAGES.map((s) => s.key),
    NO_FILTERS.stage
  ),
  status: oneOf(params.get("status"), [...STATUSES, "all"], "all"),
  code: oneOf(params.get("code"), ["all", "public", "private"], "all"),
  sort: oneOf(params.get("sort"), Object.keys(SORTS) as Sort[], "rank"),
  ranks: oneOf(params.get("ranks"), ["public", "everyone"], "public"),
})

/** The query string without what is at its default. */
export function toQuery(filters: Filters) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value.trim() && value !== NO_FILTERS[key as keyof Filters]) params.set(key, value)
  }
  return params.toString()
}

const VALUE: Record<Exclude<Sort, "rank">, (e: Entry) => number | null> = {
  claimed: (e) => e.score,
  stars: (e) => e.stars,
  commits: (e) => e.commits7d,
  // By day, since a first mention has no time.
  newest: (e) => (e.origin ? Date.parse(day(e.origin.at)) : null),
  oldest: (e) => (e.origin ? -Date.parse(day(e.origin.at)) : null),
}

/** Ties keep the standings order, and what isn't known goes last. */
export function applyFilters<T extends Entry>(entries: T[], f: Filters): T[] {
  const q = f.q.trim().toLowerCase()
  const found = entries.filter(
    (e) =>
      (!q || e.name.toLowerCase().includes(q) || e.repo?.toLowerCase().includes(q)) &&
      (f.stage === "all" || e.claimedStage === f.stage) &&
      (f.status === "all" || e.status === f.status) &&
      (f.code === "all" || e.isPrivate === (f.code === "private"))
  )
  if (f.sort === "rank") return found
  const value = VALUE[f.sort]
  return found.sort((a, b) => {
    const [x, y] = [value(a), value(b)]
    if (x === null || y === null) return Number(x === null) - Number(y === null)
    return y - x
  })
}
