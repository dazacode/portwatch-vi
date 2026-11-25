import { unstable_cache } from "next/cache"
import { plainTitle } from "@/lib/format"
import { compareToLast, gain, headline, type Milestone, rate } from "@/lib/milestones"
import { SITE } from "@/lib/site"
import { getMilestones, getStandings, getTracker, type Tracker } from "@/lib/tracker"
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
  | (Base & { kind: "race"; rows: { id: string; name: string; score: number; stage: string }[] })
  | (Base & { kind: "commit"; commit: Commit })
  | (Base & { kind: "update"; text: string; date: string })

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

function milestoneSlide(m: Milestone, earlier: Milestone[], verified: boolean): Slide {
  const last = earlier.findLast((e) => e.id === m.id) ?? null
  const { stars, size } = rate(m)
  const notes = [
    m.first && "First project to get this far",
    m.lead && "Took the lead",
    !verified && "Not independently verified",
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
  const [tracker, milestones] = await Promise.all([getTracker(), getMilestones()])
  const commits = await getCommits(tracker)
  const standings = getStandings(tracker).filter((s) => !s.nuked)
  const verified = new Set(standings.filter((s) => s.verified).map((s) => s.id))
  const scoreOf = new Map(standings.map((s) => [s.id, s.score]))

  const moves = milestones
    .map((m, i) => milestoneSlide(m, milestones.slice(0, i), verified.has(m.id)))
    .slice(-6)
    .reverse()
  const race: Slide = {
    kind: "race",
    id: "race",
    projectId: null,
    level: standings[0]?.score ?? 0,
    rows: standings.slice(0, 5).map(({ id, name, score, stage }) => ({ id, name, score, stage })),
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

  return {
    at: new Date().toISOString(),
    slides: interleave(moves, [race, ...pushes], updates),
    commits,
  }
}
