// The override file is ours alone; these guard the merging rules the site and the CLI rely on.
import { describe, expect, it } from "vitest"
import { applyOverrides } from "../lib/overrides.mjs"

const base = () => ({
  updated: "2026-01-02T00:00:00.000Z",
  efforts: [],
  news: [],
  changes: [],
  candidates: [],
  ignored: [],
  exe: {},
  scout: { lastRun: "2026-01-02T00:00:00.000Z" },
})

describe("applyOverrides news", () => {
  it("puts ours first and keeps upstream's", () => {
    const tracker = { ...base(), news: [{ id: "old" }, { id: "older" }] }
    const { tracker: out } = applyOverrides(tracker, {
      patches: [],
      added: [],
      news: [{ id: "new" }],
    })
    expect(out.news.map((n: { id: string }) => n.id)).toEqual(["new", "old", "older"])
  })

  it("hides a removed article and drops duplicates", () => {
    const tracker = { ...base(), news: [{ id: "old" }] }
    const { tracker: out } = applyOverrides(tracker, {
      patches: [],
      added: [],
      news: [{ id: "old", title: "ours" }],
      removedNews: ["gone"],
    })
    expect(out.news).toEqual([{ id: "old", title: "ours" }])
  })

  it("caps the list at 40", () => {
    const tracker = { ...base(), news: Array.from({ length: 40 }, (_, i) => ({ id: `n${i}` })) }
    const { tracker: out } = applyOverrides(tracker, {
      patches: [],
      added: [],
      news: [{ id: "mine" }],
    })
    expect(out.news).toHaveLength(40)
    expect(out.news[0].id).toBe("mine")
    expect(out.news.at(-1).id).toBe("n38")
  })

  it("is unfiltered without overrides", () => {
    const tracker = { ...base(), news: [{ id: "old" }] }
    const { tracker: out } = applyOverrides(tracker, { patches: [], added: [] })
    expect(out.news.map((n: { id: string }) => n.id)).toEqual(["old"])
  })
})

describe("applyOverrides inbox", () => {
  it("drops a decided candidate and keeps the ignored note in front", () => {
    const tracker = {
      ...base(),
      candidates: [{ repo: "a/b" }, { repo: "c/d" }],
      ignored: [{ repo: "x/y", reason: "old" }],
    }
    const { tracker: out } = applyOverrides(tracker, {
      patches: [],
      added: [],
      decided: ["a/b"],
      ignored: [{ repo: "c/d", reason: "new" }],
    })
    expect(out.candidates.map((c: { repo: string }) => c.repo)).toEqual(["c/d"])
    expect(out.ignored.map((i: { repo: string }) => i.repo)).toEqual(["c/d", "x/y"])
  })
})

describe("applyOverrides patches", () => {
  const effort = { id: "p", name: "P", summary: "", blockers: [], gta: { world: 0 }, stats: {} }

  it("applies in order and skips a lapsed one", () => {
    const tracker = { ...base(), efforts: [effort] }
    const overrides = {
      patches: [
        { id: "p", from: { "gta.world": 0 }, to: { "gta.world": 1 } },
        { id: "p", from: { "gta.world": 0 }, to: { "gta.world": 0.5 } },
      ],
      added: [],
    }
    const { tracker: out, lapsed } = applyOverrides(tracker, overrides)
    expect(out.efforts[0].gta.world).toBe(1)
    expect(lapsed).toEqual([{ id: "p", why: expect.stringContaining("upstream changed") }])
  })
})
