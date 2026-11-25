import { describe, expect, it } from "vitest"
import {
  challenge,
  challengeStage,
  currentWindow,
  findChallenge,
  WINDOW_MS,
} from "@/lib/challenge.mjs"
import { type Evidence, getStandings, type Tracker } from "@/lib/tracker"
import { confidence, verify } from "@/lib/verification.mjs"
import { parseForm } from "@/scripts/lib/challenge-form.mjs"
import { checkReading, disqualify, isCopy, readByRule } from "@/scripts/lib/evidence.mjs"

const report = (by: string, stage: string, kind = "tester", outcome = "reached") => ({
  by,
  stage,
  kind,
  outcome,
})
const three = ["a", "b", "c"].map((by) => report(by, "world"))

describe("confidence", () => {
  it("needs several independent people", () => {
    expect(confidence(three.slice(0, 1), "world")).toBeCloseTo(0.35)
    expect(confidence(three.slice(0, 2), "world")).toBeCloseTo(0.5775)
    expect(confidence(three, "world")).toBeCloseTo(0.725)
  })
  it("counts a person once, at their best", () => {
    const same = [report("a", "world"), report("a", "world"), report("a", "world", "rule")]
    expect(confidence(same, "world")).toBeCloseTo(0.35)
  })
  it("counts a later stage for the earlier ones, not the other way round", () => {
    expect(confidence(three, "menu")).toBeCloseTo(0.725)
    expect(confidence(three, "playable")).toBe(0)
  })
  it("drops with failures, but not from someone who later got there", () => {
    const failed = [...three, report("d", "world", "tester", "failed")]
    expect(confidence(failed, "world")).toBeLessThan(0.7)
    expect(confidence([...three, report("a", "world", "tester", "failed")], "world")).toBeCloseTo(
      0.725
    )
  })
})

describe("the order", () => {
  it("puts evidence above a bigger claim", () => {
    const effort = (id: string, fps: number) => ({
      id,
      name: id,
      repo: "a/b",
      tier: "tracked",
      summary: "",
      blockers: [],
      verification: "self-reported",
      gta: { loads: 1, boots: 1, menu: 1, world: 1, playable: 1, fps },
      stats: {},
    })
    const tracker = { efforts: [effort("loud", 30), effort("tested", 3)] } as unknown as Tracker
    const evidence = [{ ...report("a", "menu"), effortId: "tested" }] as unknown as Evidence[]
    expect(getStandings(tracker, evidence).map((s) => s.id)).toEqual(["tested", "loud"])
    expect(getStandings(tracker, []).map((s) => s.id)).toEqual(["loud", "tested"])
  })
})

describe("verify", () => {
  it("gives points for the furthest stage with no gap before it", () => {
    expect(verify(three, 60)).toMatchObject({ reached: "world", score: 40 })
    expect(verify([], 61)).toMatchObject({ reached: null, score: 0 })
  })
  it("never goes above what the project claims", () => {
    expect(verify(three, 35).score).toBe(35)
  })
  it("does not pass on one challenge alone", () => {
    expect(verify([report("x", "playable", "challenge")], 61).score).toBe(0)
  })
  it("verifies a private build with challenges on two days", () => {
    const days = [
      report("day 1", "playable", "challenge"),
      report("day 2", "playable", "challenge"),
    ]
    expect(verify(days, 61)).toMatchObject({ reached: "playable", score: 50 })
  })
})

const issue = (over = {}) => ({
  title: "Test report",
  body: "RTX 4070, main at 4e17478a. It holds 4.2 fps in the world.",
  authorAssociation: "NONE",
  author: { login: "someone", createdAt: "2020-01-01T00:00:00Z" },
  ...over,
})

describe("test reports", () => {
  it("accepts an independent report and says why it refuses others", () => {
    expect(disqualify(issue())).toBeNull()
    expect(disqualify(issue({ authorAssociation: "MEMBER" }))).toBe("project member")
    expect(disqualify(issue({ author: { login: "n", createdAt: new Date().toISOString() } }))).toBe(
      "new account"
    )
    expect(disqualify(issue({ body: "main at 4e17478a, 4 fps in the world" }))).toBe(
      "no graphics card"
    )
    expect(disqualify(issue({ body: "RTX 4070, 4 fps in the world" }))).toBe("no commit")
  })
  it.each([
    ["4.2 fps in the world", "world"],
    ["With that it boots and reaches the menus.", "menu"],
    ["With the skip I have walked around the prologue without a fault", "playable"],
  ])("reads %s", (body, stage) =>
    expect(readByRule(issue({ title: "", body }))).toMatchObject({ stage, outcome: "reached" })
  )
  it.each([
    "The driver crashes, which ends the title while it loads into the world.",
    "It should say when it reaches the menus.",
    "I never got to the menu.",
    "Someone reported it reaches the menus.",
    "> reaches the menus",
    "WARP can't reach the world at that speed.",
    "```\nreaches the menus\n```",
  ])("leaves out: %s", (body) => expect(readByRule(issue({ title: "", body }))).toBeNull())
  it("keeps a reading only if its quote is in the report", () => {
    const reading = { outcome: "reached", stage: "world", quote: "holds 4.2 fps in the world" }
    expect(checkReading(reading, issue())).toMatchObject({ stage: "world" })
    expect(checkReading({ ...reading, quote: "holds 60 fps in the world" }, issue())).toBeNull()
    expect(checkReading({ ...reading, outcome: "none" }, issue())).toBeNull()
    expect(checkReading({ ...reading, stage: "complete" }, issue())).toBeNull()
  })
  it("spots a report copied from another person", () => {
    const body =
      "I ran this build for an hour on my own machine and it reached the menus every time"
    const mine = issue({ body, author: { login: "a" } })
    expect(isCopy(mine, [mine, issue({ body, author: { login: "b" } })])).toBe(true)
    expect(isCopy(mine, [mine])).toBe(false)
  })
})

describe("challenges", () => {
  const now = Date.parse("2026-11-25T01:03:00Z")
  const issued = challenge("secret", "suri", "playable", currentWindow(now))
  it("gives three different actions and a window of ten minutes", () => {
    expect(new Set(issued.actions).size).toBe(3)
    expect(Date.parse(issued.endsAt) - Date.parse(issued.startsAt)).toBe(WINDOW_MS)
  })
  it("differs by project, time and secret", () => {
    const w = currentWindow(now)
    for (const other of [
      challenge("secret", "cgbj", "playable", w),
      challenge("secret", "suri", "playable", w + 1),
      challenge("other", "suri", "playable", w),
    ])
      expect(other.code).not.toBe(issued.code)
  })
  it("recognises its own code for a week, for that project only", () => {
    expect(findChallenge("secret", "suri", issued.code, now + 3 * 864e5)).toMatchObject({
      stage: "playable",
    })
    expect(findChallenge("secret", "suri", issued.code, now + 8 * 864e5)).toBeNull()
    expect(findChallenge("secret", "cgbj", issued.code, now)).toBeNull()
  })
  it("asks for what the project says it can do", () => {
    expect(challengeStage("playable")).toBe("playable")
    expect(challengeStage("world")).toBe("menu")
  })
  it("reads the issue form and ignores blanks", () => {
    const body =
      "### Project\r\n\r\nsuri\r\n\r\n### Code\n\nflamingo-4821\n\n### Build\n\n_No response_"
    expect(parseForm(body)).toEqual({ project: "suri", code: "FLAMINGO-4821", build: "", gpu: "" })
    expect(parseForm(null).project).toBe("")
  })
})
