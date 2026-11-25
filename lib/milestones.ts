export type Milestone = {
  at: string
  id: string
  name: string
  from: number
  to: number
  stageFrom: string
  stageTo: string
  /** The project's first appearance, so there is no earlier score to compare with. */
  debut: boolean
  /** No project had reached this stage before. */
  first: boolean
  /** It passed every other project. */
  lead: boolean
}

export const SIZES = ["Small step", "Solid move", "Big jump", "Huge", "Historic"] as const

const PLAYABLE = 50
export const gain = (m: Milestone) => Math.round((m.to - m.from) * 10) / 10

/** One to five stars. The rules are explained to visitors on the Method page. */
export function rate(m: Milestone): { stars: number; size: (typeof SIZES)[number] } {
  const stars = (() => {
    if (m.first) return 5
    if (m.debut) return m.lead ? 5 : m.to >= PLAYABLE ? 3 : 1
    const points = gain(m)
    return points < 2 ? 1 : points < 5 ? 2 : points < 10 ? 3 : points < 20 ? 4 : 5
  })()
  return { stars, size: SIZES[stars - 1] }
}

export function compareToLast(m: Milestone, last: Milestone | null) {
  if (m.debut) return "New on the board"
  if (!last) return "Its first jump on record"
  const before = gain(last)
  const ratio = gain(m) / before
  if (ratio >= 1.5) return `${Number(ratio.toFixed(1))}× its last jump`
  if (ratio > 0.67) return "About the same as its last jump"
  return `Smaller than its last jump, which was ${before} points`
}

const REACHED: Record<string, string> = {
  loads: "runs the game’s executable",
  boots: "draws its first frame",
  menu: "reaches the main menu",
  world: "gets into the world",
  playable: "is playable",
  complete: "runs the whole game",
}

export function headline(m: Milestone) {
  if (m.debut && m.stageTo !== "groundwork") return `${m.name} ${REACHED[m.stageTo]}`
  if (m.stageTo !== m.stageFrom) return `${m.name} ${REACHED[m.stageTo]}`
  return `${m.name} moves up ${gain(m)} points`
}
