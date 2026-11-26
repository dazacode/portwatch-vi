import type { BoardEvent } from "@/lib/board"
import type { Milestone } from "@/lib/milestones"
import type { Ours } from "@/lib/score-colors"
import { isGone, type Project } from "@/lib/standings"

export const LANES = 8

export type Racer = {
  id: string
  name: string
  score: number
  isPrivate: boolean
  /** Our score for it at that moment, when the caller can work it out. */
  ours?: Ours
}
/** The furthest projects at one moment, best first, and the highest by our count then. */
export type Frame = { at: string; racers: Racer[]; best?: Ours & { id: string; name: string } }

/** Our score for a project that claims `claim` at the moment `at`. */
export type RateAt = (project: Project, claim: number, at: string) => Ours

type Move = { id: string; at: string; from: number; to: number; debut: boolean }

// Moves recorded this close together are one moment of the replay.
const SAME = 30 * 60_000

/**
 * The race as it was recorded, then as it stands. A project is on the track from its first recorded
 * move, or from the day it joined. Before that its place isn't known, so it isn't drawn.
 */
export function getRace(
  projects: Project[],
  milestones: Pick<Milestone, "id" | "at" | "from" | "to" | "debut">[],
  board: Pick<BoardEvent, "kind" | "projectId" | "at">[],
  now: string,
  rateAt?: RateAt
): Frame[] {
  // Only what is ranked in the view it is drawn for.
  const running = projects.filter((p) => p.rank !== null && !isGone(p))
  const ids = new Set(running.map((p) => p.id))
  const moves: Move[] = milestones.filter((m) => ids.has(m.id))
  const moved = new Set(moves.map((m) => m.id))
  for (const e of board) {
    const p = running.find((x) => x.id === e.projectId)
    if (e.kind !== "joined" || !p || moved.has(p.id)) continue
    moves.push({ id: p.id, at: e.at, from: 0, to: p.score, debut: true })
  }
  moves.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))

  const score = new Map<string, number>()
  for (const p of running) {
    const first = moves.find((m) => m.id === p.id)
    if (first && !first.debut) score.set(p.id, first.from)
  }
  const top = (at: string): Pick<Frame, "racers" | "best"> => {
    const all = running.flatMap((p) => {
      const s = score.get(p.id)
      if (s === undefined) return []
      const racer: Racer = { id: p.id, name: p.name, score: s, isPrivate: p.isPrivate }
      if (rateAt) racer.ours = rateAt(p, s, at)
      return [racer]
    })
    const racers = all.toSorted((a, b) => b.score - a.score).slice(0, LANES)
    const first = all
      .filter((r) => r.ours)
      .toSorted((a, b) => (b.ours?.rating ?? 0) - (a.ours?.rating ?? 0))[0]
    const best = first?.ours ? { id: first.id, name: first.name, ...first.ours } : undefined
    return best ? { racers, best } : { racers }
  }
  const same = (a: Pick<Frame, "racers" | "best">, b: Pick<Frame, "racers" | "best">) =>
    JSON.stringify([a.racers, a.best]) === JSON.stringify([b.racers, b.best])

  const frames: Frame[] = []
  for (const [i, m] of moves.entries()) {
    score.set(m.id, m.to)
    const next = moves[i + 1]
    if (next && Date.parse(next.at) - Date.parse(m.at) < SAME) continue
    const frame = { at: m.at, ...top(m.at) }
    // A move below the lanes changes nothing anyone can see.
    const last = frames.at(-1)
    if (!last || !same(last, frame)) frames.push(frame)
  }
  for (const p of running) score.set(p.id, p.score)
  const end = { at: now, ...top(now) }
  const last = frames.at(-1)
  if (last && same(last, end)) frames.pop()
  return [...frames, end]
}
