import { describe, expect, it } from "vitest"
import { challengeStage } from "@/lib/challenge.mjs"
import { compareToLast, headline, type Milestone, rate } from "@/lib/milestones"
import { MILESTONES, scoreEffort } from "@/lib/scoring.mjs"
import { goalsOf, STAGE_ORDER, stageLabel, stageOf } from "@/lib/stages.mjs"
import { getAnswer, type Tracker } from "@/lib/tracker"
import { addMilestones, scores } from "@/scripts/lib/milestones.mjs"

const IN = { loads: 1, boots: 1, menu: 1, world: 1, playable: 1 }
const URL = "https://example.com/run"
const build = (gta: object, goalProof?: object) => ({
  id: "a",
  name: "A",
  gta: { ...IN, story: 0, render: 0, fps: 0, stability: "unknown", ...gta },
  goalProof,
  // Upstream's own field, which must never count.
  proof: { label: "Watch", url: URL, fps: URL, render: URL, story: URL },
})
const smooth = { fps: 24, render: 0.75 }
const both = { fps: URL, render: URL }

describe("our stages", () => {
  it("calls upstream's playable runnable, and puts two goals after it", () => {
    expect(STAGE_ORDER.map((s) => s.label).slice(5)).toEqual([
      "Runnable",
      "Playable",
      "Story beaten",
      "Complete",
    ])
    expect(MILESTONES.find((m) => m.key === "playable")?.label).toBe("Playable")
  })
  it("keeps a slow or broken build at runnable, whatever is linked", () => {
    expect(stageLabel(stageOf(build({ fps: 5, render: 1 }, both)))).toBe("Runnable")
    expect(stageOf(build({ fps: 30, render: 0.5 }, both))).toBe("playable")
    expect(stageOf(build({ ...smooth, playable: 0.5 }, both))).toBe("world")
  })
  it("needs evidence for every part, not a claim", () => {
    expect(stageOf(build(smooth))).toBe("playable")
    expect(stageOf(build(smooth, { fps: URL }))).toBe("playable")
    expect(stageOf(build(smooth, { fps: URL, render: "http://example.com" }))).toBe("playable")
    expect(stageOf(build({ ...smooth, fps: 20 }, both))).toBe("smooth")
    expect(goalsOf(build(smooth, { fps: URL }))[0].checks.map((c) => [c.claimed, c.met])).toEqual([
      [true, true],
      [true, false],
    ])
  })
  it("beats the story only at that speed and with that picture", () => {
    const proof = { ...both, story: URL }
    expect(stageOf(build({ story: 0.85, fps: 4, render: 0.75 }, proof))).toBe("playable")
    expect(stageOf(build({ ...smooth, story: 0.85 }, proof))).toBe("beaten")
    expect(stageOf(build({ ...smooth, story: 0.85 }, both))).toBe("smooth")
  })
  it("does not call a claim complete without evidence", () => {
    const all = { story: 1, render: 1, fps: 30, stability: "stable" }
    expect(scoreEffort(build(all)).reached).toBe("complete")
    expect(stageOf(build(all))).toBe("playable")
    expect(stageOf(build(all, { ...both, story: URL }))).toBe("complete")
  })
  it("adds no points", () => {
    expect(scoreEffort(build(smooth, both)).score).toBe(scoreEffort(build(smooth)).score)
  })
  it("records reaching one as a milestone of its own", () => {
    const at = "2026-11-25T10:00:00.000Z"
    const before = scores([build(smooth)])
    const after = scores([build(smooth, both)])
    const [m] = addMilestones([], before, after, at) as Milestone[]
    expect(m).toMatchObject({ stageFrom: "playable", stageTo: "smooth", first: true })
    expect(headline(m)).toBe("A is playable")
    expect(rate(m).stars).toBe(5)
    expect(rate({ ...m, first: false }).stars).toBe(4)
    expect(compareToLast(m, m)).not.toMatch(/NaN|Infinity/)
    const later = scores([build({ ...smooth, fps: 23 }, both)])
    expect(addMilestones([m], after, later, "2026-11-25T11:00:00.000Z")).toHaveLength(1)
    expect(addMilestones([m], after, before, "2026-11-25T11:00:00.000Z")).toEqual([])
  })
  it("challenges a playable build in the game, not in the menu", () => {
    expect(challengeStage("smooth")).toBe("playable")
    expect(challengeStage("beaten")).toBe("playable")
  })
})

describe("the sign on the home page", () => {
  const verdict = (...efforts: object[]) =>
    getAnswer({ efforts: efforts.map((e) => ({ stats: {}, ...e })) } as unknown as Tracker).verdict
  it("says not yet while no build has a recorded Playable speed", () => {
    expect(verdict(build({ fps: 5, render: 0.5 }, both))).toBe("no")
    expect(verdict(build({ fps: 25, render: 0.5 }))).toBe("no")
  })
  it("says maybe for a recorded 20 fps without the picture", () => {
    expect(verdict(build({ fps: 25, render: 0.7 }, { fps: URL, render: URL }))).toBe("maybe")
  })
  it("says yes, unofficially once a build reaches Playable", () => {
    expect(verdict(build({ fps: 22, render: 0.75 }, both))).toBe("unofficial")
  })
  it("ignores a build that was taken down", () => {
    expect(verdict({ ...build({ fps: 25, render: 0.7 }, both), nuked: { at: "2026-11-26" } })).toBe(
      "no"
    )
  })
})
