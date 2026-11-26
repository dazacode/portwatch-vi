import { describe, expect, it } from "vitest"
import { rate } from "@/lib/rating.mjs"
import { scoreAt } from "@/lib/score-at"
import { scoreEffort } from "@/lib/scoring.mjs"
import { verify } from "@/lib/verification.mjs"

const gta = {
  loads: 1,
  boots: 1,
  menu: 1,
  world: 1,
  playable: 1,
  story: 0.25,
  render: 0.75,
  fps: 6,
  stability: "rarely",
}
const effort = {
  id: "a",
  name: "A",
  gta,
  stats: {},
  tier: "tracked",
  verification: "self-reported",
  summary: "",
  blockers: [],
}
const evidence = [
  { kind: "tester", outcome: "reached", stage: "world", by: "x" },
  { kind: "challenge", outcome: "reached", stage: "menu", by: "y" },
  { kind: "tester", outcome: "failed", stage: "playable", by: "z" },
] as const

describe("scoreAt", () => {
  it("gives today's score when given today's claim and reports", () => {
    const claim = scoreEffort(effort).score
    const today = rate(effort, verify([...evidence], claim).stages)
    expect(scoreAt(claim, [...evidence], today.parts).rating).toBe(today.score)
  })

  it("counts only the reports filed by then", () => {
    const claim = scoreEffort(effort).score
    const today = rate(effort, verify([...evidence], claim).stages)
    const before = scoreAt(claim, [], today.parts)
    expect(before.rating).toBeLessThan(today.score)
    expect(before.rating).toBe(Math.round((claim / 2) * 10) / 10)
  })

  it("counts groundwork below the first stage for nothing", () => {
    expect(scoreAt(5, [], []).rating).toBe(2.5)
    expect(scoreAt(5, [], []).parts[0].key).toBe("groundwork")
  })
})
