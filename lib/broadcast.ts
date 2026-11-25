import { unstable_cache } from "next/cache"
import { type BoardEvent, getBoard, isRecent } from "@/lib/board"
import { type Breakdown, getBreakdowns, getDigest, getNote } from "@/lib/digest"
import { plainTitle } from "@/lib/format"
import { isHidden } from "@/lib/hide"
import type { Stream } from "@/lib/live/types"
import { compareToLast, gain, headline, type Milestone, rate, reachedGoal } from "@/lib/milestones"
import { SITE } from "@/lib/site"
import { getProjects, type Project, reporters } from "@/lib/standings"
import {
  type ActivityCommit,
  type Drop,
  getActivity,
  getDrop,
  getEvidence,
  getMilestones,
  getNews,
  getStandings,
  getTracker,
  LADDER,
  type PullRequest,
  type Tracker,
} from "@/lib/tracker"
import { TRAILERS } from "@/lib/trailers"
import { VERIFIED_AT } from "@/lib/verification.mjs"
import type { WireItem } from "@/lib/wire"
import { wireItems } from "@/lib/wire"
import { lastCommits, recentCommitsFast } from "@/scripts/lib/pulse.mjs"

export type Commit = {
  projectId: string
  name: string
  sha: string
  message: string
  at: string
  url: string
}

type Base = {
  id: string
  projectId: string | null
  level: number
  /** A line an AI model wrote about exactly this item. Shown under it, never instead of it. */
  note?: string
}

export type Slide =
  | (Base & {
      kind: "milestone"
      title: string
      at: string
      stars: number
      size: string
      points: number
      from: number
      to: number
      debut: boolean
      compare: string
      notes: string[]
    })
  | (Base & {
      kind: "race"
      rows: { id: string; name: string; score: number; rating: number; next: string }[]
    })
  | (Base & { kind: "commit"; commit: Commit })
  | (Base & { kind: "update"; text: string; date: string })
  | (Base & { kind: "trailer"; stream: Stream })
  | (Base & { kind: "wire"; item: WireItem })
  | (Base & { kind: "board"; event: BoardEvent })
  | (Base & { kind: "breakdown"; breakdown: Breakdown })

export type Leader = {
  id: string
  name: string
  stage: string
  rating: number
  score: number
  steps: number[]
  isPrivate: boolean
  /** We placed it ourselves. */
  picked: boolean
  /** People outside the project who have reported on it. */
  reporters: number
}

const toLeader = ({
  id,
  name,
  stage,
  rating,
  score,
  steps,
  isPrivate,
  pick,
  checks,
}: Project): Leader => ({
  id,
  name,
  stage,
  rating,
  score,
  steps,
  isPrivate,
  picked: pick !== null,
  reporters: reporters(checks),
})

export type Broadcast = {
  at: string
  drop: Drop | null
  leaders: Leader[]
  /** The same, with private builds ranked too. */
  everyone: Leader[]
  slides: Slide[]
  /** The last commit of each project. */
  commits: Commit[]
  /** Every recent commit, newest first, as it happens. */
  feed: Commit[]
}

const FEED_LENGTH = 40

/** Atom feeds first: instant and keyless. The token path and the pulse branch are fallbacks. */
const liveCommits = unstable_cache(
  async (): Promise<Commit[]> => {
    const tracker = await getTracker()
    const targets = tracker.efforts
    const live = await recentCommitsFast(targets, 10).catch(() => [])
    if (live.length) return live
    const token = process.env.GITHUB_TOKEN
    let pulse: Record<string, Omit<Commit, "projectId" | "name">> = {}
    if (token) {
      pulse = await lastCommits(targets, token)
    } else {
      const res = await fetch(`https://raw.githubusercontent.com/${SITE.repo}/pulse/pulse.json`, {
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 20 },
      })
      if (!res.ok) throw new Error(`Pulse answered ${res.status}`)
      pulse = (
        (await res.json()) as { commits: Record<string, Omit<Commit, "projectId" | "name">> }
      ).commits
    }
    return targets.flatMap((e) =>
      pulse[e.id] ? [{ ...pulse[e.id], projectId: e.id, name: e.name }] : []
    )
  },
  ["pulse-2"],
  { revalidate: 15 }
)

async function getFeed(tracker: Tracker): Promise<Commit[]> {
  const live = await liveCommits().catch((err) => {
    console.error("[broadcast] no commits:", err instanceof Error ? err.message : err)
    return [] as Commit[]
  })
  const names = new Set(tracker.efforts.filter((e) => !e.nuked).map((e) => e.id))
  return live
    .filter((c) => names.has(c.projectId) && !isHidden(c))
    .map((c) => ({ ...c, message: plainTitle(c.message) }))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}

function firstBy<T>(list: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>()
  return list.filter((item) => {
    const k = key(item)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

const lastPerProject = (feed: Commit[]) => firstBy(feed, (c) => c.projectId)
// Forks carry each other's history, so the same commit can arrive from several projects.
const shownFeed = (feed: Commit[]) => firstBy(feed, (c) => c.sha).slice(0, FEED_LENGTH)

export async function getWire(): Promise<WireItem[]> {
  return wireItems(
    (await liveCommits()).filter((c) => !isHidden(c)),
    (await getActivity()).feed.filter(isPull),
    Date.now()
  )
}

const isPull = (item: PullRequest | ActivityCommit): item is PullRequest => "number" in item

function milestoneSlide(m: Milestone, earlier: Milestone[], sure: number): Slide {
  const last = earlier.findLast((e) => e.id === m.id) ?? null
  const { stars, size } = rate(m)
  const notes = [
    m.first && "First project to get this far",
    m.lead && "Took the lead",
    reachedGoal(m)
      ? "Shown with evidence"
      : sure >= VERIFIED_AT
        ? `Verified, ${Math.round(sure * 100)}% sure`
        : sure > 0
          ? `Not verified yet, ${Math.round(sure * 100)}% sure`
          : "No independent evidence yet",
  ]
  return {
    kind: "milestone",
    id: `milestone:${m.id}:${m.stageTo}:${m.to}`,
    projectId: m.id,
    level: m.to,
    title: headline(m),
    at: m.at,
    stars,
    size,
    points: gain(m),
    from: m.from,
    to: m.to,
    debut: m.debut,
    compare: compareToLast(m, last),
    notes: notes.filter((n) => n !== false),
  }
}

/** Takes one from each list in turn, so the show keeps changing pace. */
export function interleave<T>(...lists: T[][]): T[] {
  const longest = Math.max(0, ...lists.map((l) => l.length))
  return Array.from({ length: longest }, (_, i) =>
    lists.flatMap((l) => (i < l.length ? [l[i]] : []))
  ).flat()
}

const noted = (slide: Slide, note: string | null): Slide => (note ? { ...slide, note } : slide)

export const breakdownSlides = (breakdowns: Breakdown[]): Slide[] =>
  breakdowns.map((breakdown) => ({
    kind: "breakdown",
    id: breakdown.id,
    projectId: null,
    level: 50,
    breakdown,
  }))

export async function getBroadcast(): Promise<Broadcast> {
  const [tracker, milestones, evidence, activity, news, digest] = await Promise.all([
    getTracker(),
    getMilestones(),
    getEvidence(),
    getActivity(),
    getNews(),
    getDigest(),
  ])
  const [feed, wire, board] = await Promise.all([getFeed(tracker), getWire(), getBoard()])
  const commits = lastPerProject(feed)
  const standings = getStandings(tracker, evidence).filter((s) => !s.nuked)
  const checks = new Map(standings.map((s) => [s.id, s.checks]))
  const sure = (m: Milestone) =>
    checks.get(m.id)?.find((c) => c.stage === m.stageTo)?.confidence ?? 0
  const scoreOf = new Map(standings.map((s) => [s.id, s.score]))
  // The same ranking as /standings: public code only.
  const sources = { tracker, activity, milestones, evidence }
  const ranked = getProjects(standings, sources).filter((p) => p.rank !== null)
  const everyone = getProjects(standings, sources, { withPrivate: true }).filter(
    (p) => p.rank !== null
  )

  const moves = milestones
    .map((m, i) => milestoneSlide(m, milestones.slice(0, i), sure(m)))
    .slice(-6)
    .reverse()
  const race: Slide = {
    kind: "race",
    id: "race",
    projectId: null,
    level: ranked[0]?.score ?? 0,
    rows: ranked.slice(0, 5).map(({ id, name, score, rating, checks: list }) => {
      const gap = list.find((c) => !c.verified)
      const label = LADDER.find((m) => m.key === gap?.stage)?.label.toLowerCase()
      return {
        id,
        name,
        score,
        rating,
        next: gap && gap.people ? `${Math.round(gap.confidence * 100)}% sure of “${label}”` : "",
      }
    }),
  }
  const pushes = commits.slice(0, 4).map(
    (commit): Slide =>
      noted(
        {
          kind: "commit",
          id: `commit:${commit.projectId}:${commit.sha}`,
          projectId: commit.projectId,
          level: scoreOf.get(commit.projectId) ?? 0,
          commit,
        },
        getNote(digest, { url: commit.url })
      )
  )
  const updates = tracker.changes
    // Projects that went down have a slide of their own.
    .filter((c) => c.kind === "claim" || (c.kind === "down" && !/ is nuked\b/.test(c.text)))
    .slice(-3)
    .reverse()
    .map(
      (c): Slide =>
        noted(
          {
            kind: "update",
            id: `update:${c.date}:${c.text.slice(0, 60)}`,
            projectId: null,
            level: 30,
            text: plainTitle(c.text).replace(/“[-*]\s+/g, "“"),
            date: c.date,
          },
          getNote(digest, { date: c.date, text: c.text })
        )
    )

  const breaking = wire
    .filter((w) => w.severity >= 2)
    .slice(0, 3)
    .map(
      (item): Slide =>
        noted(
          {
            kind: "wire",
            id: `wire:${item.id}`,
            projectId: item.projectId,
            level: (item.projectId && scoreOf.get(item.projectId)) || 45,
            item,
          },
          getNote(digest, { url: item.url })
        )
    )

  // A join that is a milestone as well is told once.
  const told = new Set(
    moves.flatMap((m) => (m.kind === "milestone" && m.debut ? [m.projectId] : []))
  )
  const boardSlides = board
    .filter((e) => isRecent(e, 2, Date.now()) && !(e.kind === "joined" && told.has(e.projectId)))
    // Two of each, or a busy day of joins would hide a shutdown.
    .filter(
      (e, i, all) =>
        all.slice(0, i).filter((x) => (x.kind === "joined") === (e.kind === "joined")).length < 2
    )
    .map(
      (event): Slide => ({
        kind: "board",
        id: `board:${event.id}`,
        projectId: event.projectId,
        level: scoreOf.get(event.projectId) ?? 0,
        event,
      })
    )

  const trailers = TRAILERS.map(
    (stream): Slide => ({ kind: "trailer", id: stream.id, projectId: null, level: 100, stream })
  )

  return {
    at: new Date().toISOString(),
    drop: getDrop(tracker),
    leaders: ranked.slice(0, 5).map(toLeader),
    everyone: everyone.slice(0, 5).map(toLeader),
    slides: [
      ...boardSlides,
      ...breakdownSlides(getBreakdowns(digest, news, tracker)),
      ...interleave(breaking, moves, [race, ...pushes], interleave(updates, trailers)),
    ],
    commits,
    feed: shownFeed(feed),
  }
}

export type Pulse = { at: string; commits: Commit[]; feed: Commit[] }

/** Just the commits, for the independently polled lists. */
export async function getLiveCommits(): Promise<Pulse> {
  const feed = await getFeed(await getTracker())
  return { at: new Date().toISOString(), commits: lastPerProject(feed), feed: shownFeed(feed) }
}
