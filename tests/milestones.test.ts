import { describe, expect, it } from "vitest"
import { compareToLast, rate } from "@/lib/milestones"
import { addMilestones } from "@/scripts/lib/milestones.mjs"

type Row = { name: string; score: number; stage: string; gone: boolean }
const row = (score: number, stage: string): Row => ({ name: "A", score, stage, gone: false })
const map = (rows: Record<string, Row>) => new Map(Object.entries(rows))
const T0 = "2026-11-24T00:00:00.000Z"
const later = (hours: number) => new Date(Date.parse(T0) + hours * 36e5).toISOString()

describe("addMilestones", () => {
  it("records a jump and marks the first project to reach a stage", () => {
    const [e] = addMilestones(
      [],
      map({ a: row(10, "loads"), b: row(5, "groundwork") }),
      map({ a: row(20, "boots"), b: row(5, "groundwork") }),
      T0
    )
    expect(e).toMatchObject({ id: "a", from: 10, to: 20, first: true, debut: false })
  })
  it("ignores small drift, drops and projects that arrive with nothing running", () => {
    const before = map({ a: row(10, "loads"), b: row(20, "boots") })
    const after = map({ a: row(10.4, "loads"), b: row(12, "loads"), c: row(4, "groundwork") })
    expect(addMilestones([], before, after, T0)).toEqual([])
  })
  it("keeps two stages hours apart as two milestones", () => {
    const one = addMilestones([], map({ a: row(10, "loads") }), map({ a: row(30, "menu") }), T0)
    const two = addMilestones(
      one,
      map({ a: row(30, "menu") }),
      map({ a: row(40, "world") }),
      later(2)
    )
    expect(two.map((e) => e.to)).toEqual([30, 40])
  })
  it("folds a correction into the milestone it corrects", () => {
    const one = addMilestones([], map({ a: row(40, "world") }), map({ a: row(65, "playable") }), T0)
    const two = addMilestones(
      one,
      map({ a: row(65, "playable") }),
      map({ a: row(59.8, "playable") }),
      later(1)
    )
    expect(two).toHaveLength(1)
    expect(two[0].to).toBe(59.8)
  })
  it("removes a milestone that is taken back", () => {
    const one = addMilestones([], map({ a: row(10, "loads") }), map({ a: row(20, "boots") }), T0)
    expect(
      addMilestones(one, map({ a: row(20, "boots") }), map({ a: row(10, "loads") }), later(1))
    ).toEqual([])
  })
})

const event = (over = {}) => ({
  at: T0,
  id: "a",
  name: "A",
  from: 10,
  to: 14,
  stageFrom: "loads",
  stageTo: "loads",
  debut: false,
  first: false,
  lead: false,
  ...over,
})

describe("rate", () => {
  it.each([
    [{ to: 11 }, 1],
    [{ to: 14 }, 2],
    [{ to: 18 }, 3],
    [{ to: 25 }, 4],
    [{ to: 40 }, 5],
    [{ to: 20, stageTo: "boots", first: true }, 5],
    [{ from: 0, to: 10, stageTo: "loads", debut: true }, 1],
    [{ from: 0, to: 61, stageTo: "playable", debut: true, lead: true }, 5],
  ])("%j gets %i", (over, stars) => expect(rate(event(over)).stars).toBe(stars))
})

describe("compareToLast", () => {
  it("compares with the same project's previous jump", () => {
    const last = event({ from: 5, to: 10 })
    expect(compareToLast(event({ from: 10, to: 20 }), last)).toBe("2× its last jump")
    expect(compareToLast(event({ from: 10, to: 15 }), last)).toBe("About the same as its last jump")
    expect(compareToLast(event({ from: 10, to: 12 }), last)).toBe(
      "Smaller than its last jump, which was 5 points"
    )
    expect(compareToLast(event(), null)).toBe("Its first jump on record")
    expect(compareToLast(event({ debut: true }), null)).toBe("New on the board")
  })
})
