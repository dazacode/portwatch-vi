import { describe, expect, it } from "vitest"
import { getRace, LANES } from "@/lib/race"
import type { Project } from "@/lib/standings"

const NOW = "2026-11-25T12:00:00Z"
const project = (id: string, score: number, over: Partial<Project> = {}): Project =>
  ({ id, name: id, score, rank: 1, status: "active", isPrivate: false, ...over }) as Project
const move = (id: string, at: string, from: number, to: number, debut = false) => ({
  id,
  at,
  from,
  to,
  debut,
})
const names = (frame: { racers: { id: string }[] }) => frame.racers.map((r) => r.id)

describe("getRace", () => {
  it("replays the moves and ends on today's scores", () => {
    const race = getRace(
      [project("a", 40), project("b", 60)],
      [move("a", "2026-11-23T10:00:00Z", 5, 30), move("b", "2026-11-24T10:00:00Z", 0, 55, true)],
      [],
      NOW
    )
    expect(race.map(names)).toEqual([["a"], ["b", "a"], ["b", "a"]])
    expect(race.map((f) => f.racers[0].score)).toEqual([30, 55, 60])
    expect(race.at(-1)?.at).toBe(NOW)
  })

  it("puts a project without moves on the track from the day it joined", () => {
    const joined = [{ kind: "joined" as const, projectId: "b", at: "2026-11-25" }]
    const moves = [move("a", "2026-11-24T10:00:00Z", 5, 30)]
    const race = getRace([project("a", 30), project("b", 50)], moves, joined, NOW)
    expect(race.map(names)).toEqual([["a"], ["b", "a"]])
  })

  it("leaves out projects that are not ranked or gone", () => {
    const list = [
      project("a", 30),
      project("private", 90, { rank: null, status: "private" }),
      project("dead", 80, { status: "offline" }),
    ]
    const moves = [move("private", "2026-11-24T10:00:00Z", 0, 90, true)]
    expect(getRace(list, moves, [], NOW).flatMap(names)).toEqual(["a"])
  })

  it("joins moves of the same half hour and keeps to the lanes", () => {
    const list = Array.from({ length: LANES + 2 }, (_, i) => project(`p${i}`, i + 1))
    const moves = list.map((p, i) =>
      move(p.id, `2026-11-24T10:${String(i).padStart(2, "0")}:00Z`, 0, p.score, true)
    )
    const race = getRace(list, moves, [], NOW)
    expect(race).toHaveLength(1)
    expect(names(race[0])).toEqual(
      list
        .map((p) => p.id)
        .toReversed()
        .slice(0, LANES)
    )
    expect(race[0].racers).toHaveLength(LANES)
  })

  it("ranks by our score when it can work it out, and still names the furthest claim", () => {
    const list = [project("a", 80), project("b", 60), project("c", 40)]
    const moves = list.map((p, i) => move(p.id, `2026-11-24T1${i}:00:00Z`, 0, p.score, true))
    // Our score backs the smaller claims more.
    const rateAt = (p: { id: string }, claim: number) => ({ rating: 100 - claim, parts: [] })
    const race = getRace(list, moves, [], NOW, rateAt)
    const last = race.at(-1)
    expect(last && names(last)).toEqual(["c", "b", "a"])
    expect(last?.best).toMatchObject({ id: "c", rating: 60 })
    expect(last?.furthest).toMatchObject({ id: "a", score: 80 })
  })
})
