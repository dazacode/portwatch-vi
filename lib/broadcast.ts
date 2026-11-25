import { unstable_cache } from "next/cache"
import { plainTitle } from "@/lib/format"
import type { Stream } from "@/lib/live/types"
import { compareToLast, gain, headline, type Milestone, rate } from "@/lib/milestones"
import { SITE } from "@/lib/site"
import {
  getEvidence,
  getMilestones,
  getStandings,
  getTracker,
  LADDER,
  type Tracker,
} from "@/lib/tracker"
import { TRAILERS } from "@/lib/trailers"
import { VERIFIED_AT } from "@/lib/verification.mjs"
import { lastCommits } from "@/scripts/lib/pulse.mjs"

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

export type Broadcast = { at: string; slides: Slide[]; commits: Commit[] }

type Pulse = Record<string, Omit<Commit, "projectId" | "name">>

/** With GITHUB_TOKEN the site asks GitHub itself each minute. Without, it reads what the pulse workflow left. */
const getPulse = unstable_cache(
  async (): Promise<Pulse> => {
    const token = process.env.GITHUB_TOKEN
    if (token) return lastCommits((await getTracker()).efforts, token)
    const res = await fetch(`https://raw.githubusercontent.com/${SITE.repo}/pulse/pulse.json`, {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 60 },
    })
    if (!res.ok) throw new Error(`Pulse answered ${res.status}`)
    return ((await res.json()) as { commits: Pulse }).commits
  },
  ["pulse"],
  { revalidate: 60 }
)

async function getCommits(tracker: Tracker): Promise<Commit[]> {
  const pulse = await getPulse().catch((err) => {
    console.error("[broadcast] no commits:", err instanceof Error ? err.message : err)
    return {} as Pulse
  })
  return tracker.efforts
    .flatMap((e) =>
      pulse[e.id] && !e.nuked
        ? [
            {
              ...pulse[e.id],
              projectId: e.id,
              name: e.name,
              message: plainTitle(pulse[e.id].message),
            },
          ]
        : []
    )
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}

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
  const commits = await getCommits(tracker)
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

  const trailers = TRAILERS.map(
    (stream): Slide => ({ kind: "trailer", id: stream.id, projectId: null, level: 100, stream })
  )

  return {
    at: new Date().toISOString(),
    slides: interleave(moves, [race, ...pushes], interleave(updates, trailers)),
    commits,
  }
}
