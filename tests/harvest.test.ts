import { describe, expect, it } from "vitest"
import {
  categoryOf,
  isPortStory,
  mergeFeed,
  mergeNews,
  mergeProject,
  mergeRepos,
  toCommit,
  toNewsItem,
  toPull,
} from "@/scripts/lib/harvest.mjs"

const NOW = Date.parse("2026-11-24T12:00:00Z")
const ago = (h: number) => new Date(NOW - h * 36e5).toISOString()

describe("isPortStory", () => {
  it("keeps stories about a GTA VI PC port", () => {
    expect(isPortStory("GTA 6 PC port shuts down after Take-Two DMCA")).toBe(true)
    expect(isPortStory("A recompilation of GTA VI now reaches the main menu")).toBe(true)
  })

  it("drops GTA VI stories with nothing to do with PC", () => {
    expect(isPortStory("GTA 6 breaks sales records on PS5")).toBe(false)
    expect(isPortStory("GTA 6 soundtrack revealed")).toBe(false)
  })

  it("is stricter for social posts", () => {
    expect(isPortStory("I bought a new PC for GTA 6", { strict: true })).toBe(false)
    expect(isPortStory("GTA 6 is running on PC rn", { strict: true })).toBe(true)
    expect(isPortStory("GTA 6 port on GitHub taken down", { strict: true })).toBe(true)
  })
})

describe("categoryOf", () => {
  it("recognises takedowns before ordinary ports", () => {
    expect(categoryOf("DMCA takedown hits the GTA 6 port")).toBe("Takedown")
    expect(categoryOf("New GTA 6 recompiler on GitHub")).toBe("Port")
    expect(categoryOf("Rockstar confirms the leak")).toBe("Official")
    expect(categoryOf("GTA 6 port reaches the main menu")).toBe("Port")
  })
})

describe("toNewsItem", () => {
  const raw = {
    title: "GTA 6 port reaches the menu",
    link: "https://example.com/a",
    date: ago(1),
    outlet: "Example",
  }

  it("makes a stable id and a category", () => {
    const item = toNewsItem(raw, "Example", NOW)
    expect(item?.id).toContain("example.com")
    expect(item?.category).toBe("Port")
  })

  it("drops off-topic, linkless and old items", () => {
    expect(toNewsItem({ ...raw, title: "GTA 6 sells 10 million" }, "Example", NOW)).toBeNull()
    expect(toNewsItem({ ...raw, link: "" }, "Example", NOW)).toBeNull()
    expect(toNewsItem({ ...raw, date: ago(24 * 40) }, "Example", NOW)).toBeNull()
  })
})

describe("mergeNews", () => {
  it("collapses the same story from two feeds and sorts newest first", () => {
    const first = {
      id: "a",
      title: "GTA 6 port taken down",
      url: "https://a.example/x",
      date: ago(2),
      outlet: "A",
      via: "A",
      category: "Takedown",
    }
    const copy = { ...first, id: "b", url: "https://b.example/y", outlet: "B", via: "B" }
    const newer = {
      id: "c",
      title: "Another GTA 6 port",
      url: "https://c.example/z",
      date: ago(1),
      outlet: "C",
      via: "C",
      category: "Port",
    }
    const items = mergeNews([first], [copy, newer], { now: NOW })
    expect(items).toHaveLength(2)
    expect(items[0].id).toBe("c")
  })

  it("drops items older than the window", () => {
    const old = {
      id: "old",
      title: "Old GTA 6 port",
      url: "https://a.example/old",
      date: ago(24 * 30),
      outlet: "A",
      via: "A",
      category: "Port",
    }
    expect(mergeNews([old], [], { now: NOW })).toEqual([])
  })
})

describe("activity", () => {
  const commit = (sha: string, at: string) => ({
    projectId: "p",
    repo: "o/r",
    sha,
    message: "m",
    author: "a",
    at,
    url: `https://github.com/o/r/commit/${sha}`,
  })
  const pull = (n: number, state: "open" | "closed" = "open") => ({
    projectId: "p",
    repo: "o/r",
    number: n,
    title: "t",
    state,
    draft: false,
    author: "a",
    at: ago(1),
    url: `https://github.com/o/r/pull/${n}`,
  })

  it("normalises commits and pulls", () => {
    expect(
      toCommit(
        { sha: "abcdef123", commit: { message: "hi\nthere", author: { date: ago(1), name: "A" } } },
        "p",
        "o/r"
      )?.message
    ).toBe("hi")
    expect(
      toPull({ number: 3, title: "t", state: "open", user: { login: "u" } }, "p", "o/r")?.state
    ).toBe("open")
    expect(
      toPull(
        { number: 3, title: "t", state: "closed", pull_request: { merged_at: ago(1) } },
        "p",
        "o/r"
      )?.state
    ).toBe("merged")
  })

  it("deduplicates history and keeps the newest", () => {
    const previous: {
      openPrs: number
      commits: ReturnType<typeof commit>[]
      pulls: ReturnType<typeof pull>[]
    } = { openPrs: 1, commits: [commit("aaa", ago(10))], pulls: [pull(1)] }
    const merged = mergeProject(
      previous,
      { commits: [commit("aaa", ago(10)), commit("bbb", ago(1))], pulls: [] } as never,
      NOW
    )
    expect(merged.commits.map((c) => c.sha)).toEqual(["bbb", "aaa"])
    expect(merged.pulls).toHaveLength(1)
    expect(merged.openPrs).toBe(0)
  })

  it("puts pulls and commits in one feed without duplicates", () => {
    const old = [pull(1), commit("aaa", ago(5))]
    const next = mergeFeed(
      old,
      { p: { openPrs: 1, commits: [commit("aaa", ago(5))], pulls: [pull(1), pull(2)] } },
      NOW
    )
    expect(next).toHaveLength(3)
    expect(new Set(next.map((x) => x.url))).toEqual(new Set([pull(2).url, pull(1).url, old[1].url]))
  })

  it("drops stale repositories", () => {
    const stale = {
      repo: "a/b",
      pushedAt: ago(24 * 30),
      url: "https://github.com/a/b",
      description: "",
      stars: 0,
      language: null,
    }
    const fresh = { ...stale, repo: "c/d", pushedAt: ago(1) }
    expect(mergeRepos([stale], [fresh], NOW).map((r) => r.repo)).toEqual(["c/d"])
  })
})
