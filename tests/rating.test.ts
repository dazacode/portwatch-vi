import { afterEach, describe, expect, it, vi } from "vitest"
import { applyOverrides, isTracker } from "@/lib/overrides.mjs"
import { rate, shareOf } from "@/lib/rating.mjs"
import type { Effort, Tracker } from "@/lib/tracker"
import { type Evidence, getEvidence, getRecords, getStandings, getTracker } from "@/lib/tracker"
import { getUpstream, newestCommit } from "@/lib/upstream"
import { verify } from "@/lib/verification.mjs"

const PLAYABLE = { loads: 1, boots: 1, menu: 1, world: 1, playable: 1, fps: 0 }
const effort = (gta: object, over: object = {}) =>
  ({ id: "a", name: "A", gta, stats: {}, ...over }) as unknown as Effort
const none = verify([], 100).stages
const seen = (people: number, stage: string) =>
  Array.from({ length: people }, (_, i) => ({
    by: String(i),
    stage,
    kind: "tester",
    outcome: "reached",
  })) as unknown as Evidence[]

describe("our score", () => {
  it("counts half of what nobody has seen, and all of what is verified", () => {
    expect(shareOf(0)).toBe(0.5)
    expect(shareOf(0.35)).toBeCloseTo(0.75)
    expect(shareOf(0.7)).toBe(1)
    expect(shareOf(1)).toBe(1)
    expect(rate(effort(PLAYABLE), none).score).toBe(25)
    expect(rate(effort(PLAYABLE), verify(seen(3, "playable"), 50).stages).score).toBe(50)
  })
  it("counts evidence only for the stages it reaches", () => {
    const { parts } = rate(effort(PLAYABLE), verify(seen(3, "menu"), 50).stages)
    const counted = Object.fromEntries(parts.map((p) => [p.key, p.counted]))
    expect(counted).toMatchObject({ loads: 10, boots: 10, menu: 10, world: 5, playable: 5 })
  })
  it("counts half of the tracks whatever the evidence, and only once playable", () => {
    const gta = { ...PLAYABLE, story: 1, render: 1, fps: 30, stability: "stable" }
    expect(rate(effort(gta), verify(seen(3, "playable"), 100).stages).score).toBe(75)
    expect(rate(effort({ ...gta, playable: 0 }), none).score).toBe(20)
  })
  it("says not measured instead of a bad result", () => {
    const note = (gta: object) =>
      Object.fromEntries(
        rate(effort({ ...PLAYABLE, ...gta }), none).parts.map((p) => [p.key, p.note])
      )
    expect(note({ stability: "unknown" })).toMatchObject({ stability: null, perf: null })
    expect(note({ stability: "constant" }).stability).toBe("Crashes constantly")
    expect(note({ fps: 3 }).perf).toBe("3 fps")
  })
  it("shows half a stage and groundwork as what they are", () => {
    const half = rate(effort({ ...PLAYABLE, world: 0.5, playable: 0 }), none)
    expect(half.score).toBe(17.5)
    const groundwork = { loader: 1, shaders: 1, graphics: 0, proven: 0 }
    const early = rate(effort({ loads: 0 }, { groundwork }), none)
    expect(early.parts.map((p) => p.key)).toEqual(["groundwork"])
    expect(early.score).toBe(2.4)
  })
  it("never counts more than is claimed, for any project", async () => {
    for (const s of getStandings(await getTracker(), await getEvidence())) {
      const claimed = s.parts.reduce((sum, p) => sum + p.claimed, 0)
      expect(claimed).toBeCloseTo(s.score, 0)
      expect(s.rating).toBeLessThanOrEqual(s.score)
      expect(s.rating).toBeGreaterThanOrEqual(Math.floor(s.score * 5) / 10 - 0.1)
      for (const p of s.parts) {
        expect(p.counted).toBeLessThanOrEqual(p.claimed)
        expect(p.claimed).toBeLessThanOrEqual(p.max)
      }
    }
  })
  it("does not put one menu report above a playable build", () => {
    const gta = { loads: 1, boots: 1, menu: 1, world: 0.5, playable: 0, fps: 0 }
    const base = { repo: "a/b", tier: "tracked", summary: "", blockers: [], verification: "" }
    const efforts = [
      effort(gta, { ...base, id: "menu" }),
      effort(PLAYABLE, { ...base, id: "play" }),
    ]
    const evidence = [{ ...seen(1, "menu")[0], kind: "rule", effortId: "menu" }] as Evidence[]
    const order = getStandings({ efforts } as Tracker, evidence).map((s) => s.id)
    expect(order).toEqual(["play", "menu"])
  })
})

describe("overrides", () => {
  const tracker = {
    efforts: [effort({ ...PLAYABLE, render: 0.25 }, { summary: "Old." })],
    changes: [{ date: "2026-11-24", kind: "up", text: "theirs" }],
  }
  const patch = {
    id: "a",
    from: { "gta.render": 0.25, summary: "Old.", findings: null },
    to: { "gta.render": 0.9, summary: "New.", findings: [{ text: "seen" }] },
    changes: [{ date: "2026-11-24", kind: "up", text: "ours" }],
  }
  const apply = (t: object, o: object) => applyOverrides(t as never, o as never)
  it("applies while upstream stands still, and keeps upstream's score next to it", () => {
    const { tracker: out, lapsed } = apply(tracker, { patches: [patch] })
    expect(out.efforts[0]).toMatchObject({ summary: "New.", gta: { render: 0.9, menu: 1 } })
    expect(out.efforts[0].sourceScore).toBe(53.1)
    expect(out.changes.map((c: { text: string }) => c.text)).toEqual(["theirs", "ours"])
    expect(lapsed).toEqual([])
    expect(tracker.efforts[0].summary).toBe("Old.")
  })
  it("lapses as a whole once upstream changes any of it", () => {
    const moved = {
      ...tracker,
      efforts: [effort({ ...PLAYABLE, render: 0.5 }, { summary: "Old." })],
    }
    const { tracker: out, lapsed } = apply(moved, { patches: [patch] })
    expect(out.efforts[0]).toMatchObject({ summary: "Old.", gta: { render: 0.5 } })
    expect(out.efforts[0].findings).toBeUndefined()
    expect(out.changes).toHaveLength(1)
    expect(lapsed).toEqual([{ id: "a", why: "upstream changed gta.render" }])
  })
  it("says nothing when upstream came to the same", () => {
    const { from: _, ...rest } = patch
    const small = { ...rest, from: { "gta.render": 0.25 }, to: { "gta.render": 0.9 } }
    const agreed = { ...tracker, efforts: [effort({ ...PLAYABLE, render: 0.9 })] }
    expect(apply(agreed, { patches: [small] }).lapsed).toEqual([])
  })
  it("adds a project until upstream lists it, by id, name or repo", () => {
    const mine = effort(PLAYABLE, {
      id: "new",
      name: "Newcomer",
      repo: "x/new",
      related: ["x/parent"],
    })
    const added = { patches: [], added: [{ effort: mine }] }
    expect(apply(tracker, added).tracker.efforts.at(-1)).toMatchObject({
      id: "new",
      sourceScore: null,
    })
    for (const over of [
      { id: "new" },
      { name: "NEWCOMER" },
      { repo: "X/New" },
      { repo: "x/Parent" },
    ]) {
      const theirs = {
        ...tracker,
        efforts: [...tracker.efforts, effort(PLAYABLE, { id: "b", ...over })],
      }
      const { tracker: out, lapsed } = apply(theirs, added)
      expect(out.efforts).toHaveLength(2)
      expect(lapsed[0].id).toBe("new")
    }
  })
  it("survives a project that is gone, and no overrides at all", () => {
    expect(apply({ ...tracker, efforts: [] }, { patches: [patch] }).lapsed[0].why).toContain(
      "no longer"
    )
    expect(apply(tracker, {}).tracker.efforts).toHaveLength(1)
  })
})

describe("upstream", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })
  const answer = (feed: string, file: unknown, ok = true) => {
    vi.stubEnv("NODE_ENV", "production")
    vi.spyOn(console, "error").mockImplementation(() => {})
    const urls: string[] = []
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(url)
      return { ok, status: ok ? 200 : 503, text: async () => feed, json: async () => file }
    })
    return urls
  }
  const FEED = `<id>Grit::Commit/${"a".repeat(40)}</id>`
  it("reads the file at the newest commit, so no branch cache is in the way", async () => {
    const t = await getRecords()
    const urls = answer(FEED, t)
    expect((await getUpstream())?.efforts).toHaveLength(t.efforts.length)
    expect(urls[1]).toContain(`/${"a".repeat(40)}/data/tracker.json`)
  })
  it("gives way to the synced copy when upstream is down, empty or changed shape", async () => {
    answer(FEED, {}, false)
    expect(await getUpstream()).toBeNull()
    answer("<feed></feed>", {})
    expect(await getUpstream()).toBeNull()
    answer(FEED, { efforts: [] })
    expect(await getUpstream()).toBeNull()
    vi.stubGlobal("fetch", async () => {
      throw new Error("offline")
    })
    expect(await getUpstream()).toBeNull()
    expect((await getRecords()).efforts.length).toBeGreaterThan(0)
  })
  it("can be turned off", async () => {
    const urls = answer(FEED, {})
    vi.stubEnv("UPSTREAM_DATA", "off")
    expect(await getUpstream()).toBeNull()
    expect(urls).toEqual([])
  })
  it("accepts the tracker in the repo, and nothing the pages can't read", async () => {
    const t = await getRecords()
    expect(isTracker(t)).toBe(true)
    expect(isTracker(null)).toBe(false)
    expect(isTracker({ ...t, efforts: [] })).toBe(false)
    expect(isTracker({ ...t, news: undefined })).toBe(false)
    expect(isTracker({ ...t, efforts: [{ ...t.efforts[0], gta: undefined }] })).toBe(false)
  })
  it("finds the newest commit in the feed", () => {
    const sha = "baf757f7eafbf2a60feeab3ea76513d22cc05b91"
    expect(
      newestCommit(
        `<id>tag:github.com,2008:Grit::Commit/${sha}</id><id>Commit/${"0".repeat(40)}</id>`
      )
    ).toBe(sha)
    expect(newestCommit("<feed></feed>")).toBeNull()
  })
})
