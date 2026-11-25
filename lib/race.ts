import type { BoardEvent } from "@/lib/board"
import type { Milestone } from "@/lib/milestones"
import { isGone, type Project } from "@/lib/standings"

export const LANES = 5

export type Racer = { id: string; name: string; score: number; isPrivate: boolean }
/** The furthest projects at one moment, best first. */
export type Frame = { at: string; racers: Racer[] }

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
  now: string
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
  const top = (): Racer[] =>
    running
      .flatMap((p) => {
        const s = score.get(p.id)
        return s === undefined ? [] : [{ id: p.id, name: p.name, score: s, isPrivate: p.isPrivate }]
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, LANES)

  const frames: Frame[] = []
  for (const [i, m] of moves.entries()) {
    score.set(m.id, m.to)
    const next = moves[i + 1]
    if (next && Date.parse(next.at) - Date.parse(m.at) < SAME) continue
    const frame = { at: m.at, racers: top() }
    // A move below the lanes changes nothing anyone can see.
    const last = frames.at(-1)
    if (!last || JSON.stringify(last.racers) !== JSON.stringify(frame.racers)) frames.push(frame)
  }
  for (const p of running) score.set(p.id, p.score)
  const end = { at: now, racers: top() }
  const last = frames.at(-1)
  if (last && JSON.stringify(last.racers) === JSON.stringify(end.racers)) frames.pop()
  return [...frames, end]
}
