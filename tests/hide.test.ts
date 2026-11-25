import { describe, expect, it } from "vitest"
import { hideInActivity, isHidden, withoutHidden } from "@/lib/hide"
import { getActivity, getNews, getRecords, getTracker } from "@/lib/tracker"

describe("hiding the upstream project", () => {
  it("drops the sentence, not just the name", () => {
    expect(withoutHidden("Runs at 3 fps. PortWatch confirmed it. Code not public.")).toBe(
      "Runs at 3 fps. Code not public."
    )
  })

  it("looks at image credits and links as well", () => {
    expect(isHidden({ title: "Story", image: { url: "https://portwatch-vi.xyz/a.png" } })).toBe(
      true
    )
    expect(isHidden({ title: "Story" })).toBe(false)
  })

  it("drops upstream's own activity", () => {
    const commit = { projectId: "upstream", repo: "a/b", sha: "1", message: "x", author: "y" }
    const out = hideInActivity({
      updated: null,
      projects: { upstream: { openPrs: 1, commits: [], pulls: [] } },
      feed: [{ ...commit, at: "2026-11-24T00:00:00Z", url: "https://github.com/a/b" }],
      discovered: [],
    })
    expect(out.projects).toEqual({})
    expect(out.feed).toEqual([])
  })

  it("leaves nothing in what the site loads", async () => {
    const { efforts, news, changes, headlines } = await getTracker()
    expect(isHidden([news, changes, headlines])).toBe(false)
    expect(isHidden(efforts.map((e) => [e.name, e.summary, e.blockers]))).toBe(false)
    const { projects, feed, discovered } = await getActivity()
    expect(isHidden([projects, feed, discovered])).toBe(false)
    expect(isHidden((await getNews()).items)).toBe(false)
    expect(news.length).toBeLessThan((await getRecords()).news.length)
  })

  it("never empties a project's summary", async () => {
    for (const e of (await getTracker()).efforts) expect(e.summary).not.toBe("")
  })
})
