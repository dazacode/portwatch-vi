import { unstable_cache } from "next/cache"
import { plainTitle } from "@/lib/format"
import type { Stream } from "@/lib/live/types"
import { compareToLast, gain, headline, type Milestone, rate } from "@/lib/milestones"
import { SITE, UPSTREAM_NAME, UPSTREAM_REPO } from "@/lib/site"
import {
  type ActivityCommit,
  getActivity,
  getEvidence,
  getMilestones,
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

type Base = { id: string; projectId: string | null; level: number }

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
      rows: { id: string; name: string; score: number; verified: number; next: string }[]
    })
  | (Base & { kind: "commit"; commit: Commit })
  | (Base & { kind: "update"; text: string; date: string })
  | (Base & { kind: "trailer"; stream: Stream })
  | (Base & { kind: "wire"; item: WireItem })

export type Broadcast = { at: string; slides: Slide[]; commits: Commit[] }

/** Atom feeds first: instant and keyless. The token path and the pulse branch are fallbacks. */
const liveCommits = unstable_cache(
  async (): Promise<Commit[]> => {
    const tracker = await getTracker()
    const targets = [
      ...tracker.efforts,
      { id: "upstream", name: UPSTREAM_NAME, repo: UPSTREAM_REPO },
    ]
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
  ["pulse"],
  { revalidate: 15 }
)

async function getCommits(tracker: Tracker): Promise<Commit[]> {
  const live = await liveCommits().catch((err) => {
    console.error("[broadcast] no commits:", err instanceof Error ? err.message : err)
    return [] as Commit[]
  })
  const names = new Set([...tracker.efforts.filter((e) => !e.nuked).map((e) => e.id), "upstream"])
  return live
    .filter((c) => names.has(c.projectId))
    .map((c) => ({ ...c, message: plainTitle(c.message) }))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}

export async function getWire(): Promise<WireItem[]> {
  return wireItems(await liveCommits(), (await getActivity()).feed.filter(isPull), Date.now())
}

const isPull = (item: PullRequest | ActivityCommit): item is PullRequest => "number" in item

function milestoneSlide(m: Milestone, earlier: Milestone[], sure: number): Slide {
  const last = earlier.findLast((e) => e.id === m.id) ?? null
  const { stars, size } = rate(m)
  const notes = [
    m.first && "First project to get this far",
    m.lead && "Took the lead",
    sure >= VERIFIED_AT
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

export async function getBroadcast(): Promise<Broadcast> {
  const [tracker, milestones, evidence] = await Promise.all([
    getTracker(),
    getMilestones(),
    getEvidence(),
  ])
  const [commits, wire] = await Promise.all([getCommits(tracker), getWire()])
  const standings = getStandings(tracker, evidence).filter((s) => !s.nuked)
  const checks = new Map(standings.map((s) => [s.id, s.checks]))
  const sure = (m: Milestone) =>
    checks.get(m.id)?.find((c) => c.stage === m.stageTo)?.confidence ?? 0
  const scoreOf = new Map(standings.map((s) => [s.id, s.score]))

  const moves = milestones
    .map((m, i) => milestoneSlide(m, milestones.slice(0, i), sure(m)))
    .slice(-6)
    .reverse()
  const race: Slide = {
    kind: "race",
    id: "race",
    projectId: null,
    level: standings[0]?.score ?? 0,
    rows: standings.slice(0, 5).map(({ id, name, score, verified, checks: list }) => {
      const gap = list.find((c) => !c.verified)
      const label = LADDER.find((m) => m.key === gap?.stage)?.label.toLowerCase()
      return {
        id,
        name,
        score,
        verified,
        next: gap && gap.people ? `${Math.round(gap.confidence * 100)}% sure of “${label}”` : "",
      }
    }),
  }
  const pushes = commits.slice(0, 4).map(
    (commit): Slide => ({
      kind: "commit",
      id: `commit:${commit.projectId}:${commit.sha}`,
      projectId: commit.projectId,
      level: scoreOf.get(commit.projectId) ?? 0,
      commit,
    })
  )
  const updates = tracker.changes
    .filter((c) => ["claim", "removed", "down"].includes(c.kind))
    .slice(-3)
    .reverse()
    .map(
      (c): Slide => ({
        kind: "update",
        id: `update:${c.date}:${c.text.slice(0, 60)}`,
        projectId: null,
        level: 30,
        text: plainTitle(c.text).replace(/“[-*]\s+/g, "“"),
        date: c.date,
      })
    )

  const breaking = wire
    .filter((w) => w.severity >= 2)
    .slice(0, 3)
    .map(
      (item): Slide => ({
        kind: "wire",
        id: `wire:${item.id}`,
        projectId: item.projectId,
        level: (item.projectId && scoreOf.get(item.projectId)) || 45,
        item,
      })
    )

  const trailers = TRAILERS.map(
    (stream): Slide => ({ kind: "trailer", id: stream.id, projectId: null, level: 100, stream })
  )

  return {
    at: new Date().toISOString(),
    slides: interleave(breaking, moves, [race, ...pushes], interleave(updates, trailers)),
    commits,
  }
}

/** Just the commits, for the independently polled list. */
export async function getLiveCommits(): Promise<{ at: string; commits: Commit[] }> {
  const commits = await getCommits(await getTracker())
  return { at: new Date().toISOString(), commits }
}
