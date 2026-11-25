import { describe, expect, it } from "vitest"
import { wireItems } from "@/lib/wire"

const NOW = Date.parse("2026-11-24T12:00:00Z")
const mins = (n: number) => new Date(NOW - n * 60_000).toISOString()
const commit = (sha: string, message: string, at: string, projectId = "p") => ({
  projectId,
  name: "Project",
  sha,
  message,
  at,
  url: `https://github.com/o/r/commit/${sha}`,
})
const pull = (number: number, at: string, state: "open" | "merged" = "open") => ({
  projectId: "p",
  repo: "o/r",
  number,
  title: "shader work",
  state,
  draft: false,
  author: "a",
  at,
  url: `https://github.com/o/r/pull/${number}`,
})

describe("wireItems", () => {
  it("calls a burst of three commits breaking", () => {
    const items = wireItems(
      [commit("a", "one", mins(2)), commit("b", "two", mins(5)), commit("c", "three", mins(8))],
      [],
      NOW
    )
    const burst = items.find((i) => i.kind === "burst")
    expect(burst?.severity).toBe(3)
    expect(burst?.title).toContain("3 commits")
  })

  it("does not call three commits over an hour a burst", () => {
    const items = wireItems(
      [commit("a", "one", mins(1)), commit("b", "two", mins(35)), commit("c", "three", mins(70))],
      [],
      NOW
    )
    expect(items.some((i) => i.kind === "burst")).toBe(false)
  })

  it("flags a milestone word in a recent commit", () => {
    const items = wireItems([commit("a", "game: reach the main menu at last", mins(3))], [], NOW)
    expect(items[0]).toMatchObject({ kind: "signal", severity: 2 })
    expect(items[0].title).toContain("the menu")
  })

  it("notes a project coming back after a long silence", () => {
    const items = wireItems(
      [commit("a", "again", mins(4)), commit("b", "old", mins(60 * 30))],
      [],
      NOW
    )
    expect(items.some((i) => i.kind === "return")).toBe(true)
  })

  it("includes recent pull requests and merges", () => {
    const items = wireItems([], [pull(7, mins(5)), pull(8, mins(9), "merged")], NOW)
    expect(items.map((i) => i.kind).sort()).toEqual(["merge", "pull"])
  })

  it("ignores stale items and keeps one per project and kind", () => {
    const items = wireItems(
      [commit("a", "main menu", mins(4)), commit("b", "main menu too", mins(6))],
      [pull(1, mins(20)), pull(2, mins(50))],
      NOW
    )
    expect(items.filter((i) => i.kind === "signal")).toHaveLength(1)
    expect(items.filter((i) => i.kind === "pull")).toHaveLength(1)
  })

  it("gives stable ids inside the same quarter hour", () => {
    const one = wireItems([commit("a", "playable now", mins(1))], [], NOW)[0]
    const two = wireItems([commit("a", "playable now", mins(1))], [], NOW)[0]
    expect(one.id).toBe(two.id)
  })
})
