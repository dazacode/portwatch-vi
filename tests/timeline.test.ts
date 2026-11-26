import { describe, expect, it } from "vitest"
import type { BoardEvent } from "@/lib/board"
import type { IntelItem } from "@/lib/intel"
import type { Story } from "@/lib/stories"
import { dayLabel, parseShow, timeline } from "@/lib/timeline"
import type { ActivityCommit, PullRequest } from "@/lib/tracker"

const intel = (
  id: string,
  at: string,
  status: IntelItem["status"],
  projectId: string | null = null
) =>
  ({
    id,
    kind: "evidence",
    at,
    status,
    projectId,
    projectName: projectId,
    title: id,
    oneLine: "",
  }) as IntelItem
const story = (id: string, date: string, weight: number): Story => ({
  id,
  title: id,
  url: `https://example.com/${id}`,
  outlet: "Outlet",
  date,
  via: "RSS",
  topic: "Port",
  summary: null,
  similar: 0,
  weight,
})
const commit = (
  sha: string,
  at: string,
  projectId: string | null,
  repo = "a/b"
): ActivityCommit => ({
  projectId,
  repo,
  sha,
  message: `msg ${sha}`,
  author: "x",
  at,
  url: `https://github.com/${repo}/commit/${sha}`,
})
const pull = (n: number, at: string, projectId: string | null, repo = "a/b"): PullRequest => ({
  projectId,
  repo,
  number: n,
  title: `pr ${n}`,
  state: "open",
  draft: false,
  author: "x",
  at,
  url: `https://github.com/${repo}/pull/${n}`,
})
const joined: BoardEvent = {
  id: "joined:p1",
  kind: "joined",
  projectId: "p1",
  name: "P1",
  at: "2026-11-24",
  title: "P1 joined the board",
  detail: "",
}

const src = {
  intel: [
    intel("r1", "2026-11-25T10:00:00Z", "published", "p1"),
    intel("r2", "2026-11-25T09:00:00Z", "held"),
    intel("r3", "2026-11-25T08:00:00Z", "observed"),
  ],
  articles: [],
  stories: [story("s1", "2026-11-25T01:00:00Z", 1), story("s2", "2026-11-25T02:00:00Z", 9)],
  commits: [
    commit("c1", "2026-11-25T11:00:00Z", "p1"),
    commit("c2", "2026-11-25T03:00:00Z", null, "x/y"),
  ],
  pulls: [pull(7, "2026-11-25T05:00:00Z", "p1")],
  board: [joined],
  dmca: [
    {
      url: "https://github.com/github/dmca/1",
      date: "2026-11-24",
      repoCount: 3007,
      gta6: true,
      tracked: ["leonida"],
    },
  ],
  names: new Map([["p1", "P1"]]),
}

describe("the news timeline", () => {
  it("groups by day, newest first, and leaves observed items out", () => {
    const days = timeline(src)
    expect(days.map((d) => d.day)).toEqual(["2026-11-25", "2026-11-24"])
    const ids = days[0].entries.map((e) => e.id)
    expect(ids).toEqual(["code:2026-11-25", "intel:r1", "intel:r2", "press:2026-11-25"])
    expect(days[0].entries.find((e) => e.id === "intel:r2")?.kind).toBe("held")
    expect(days[1].entries.map((e) => e.kind).sort()).toEqual(["joined", "takedown"])
  })

  it("rolls the busy streams into one row a day", () => {
    const [today] = timeline(src)
    const code = today.entries.find((e) => e.kind === "code")
    expect(code?.title).toBe("1 pull request and 2 commits across 2 repositories")
    expect(code?.subs[0]).toMatchObject({ title: "P1", href: "/projects/p1" })
    const press = today.entries.find((e) => e.kind === "press")
    expect(press?.title).toBe("2 stories in the press and on social")
    expect(press?.subs[0].title).toBe("s2")
  })

  it("keeps only one project's entries when filtered", () => {
    const days = timeline(src, "p1")
    const all = days.flatMap((d) => d.entries)
    expect(all.map((e) => e.kind).sort()).toEqual(["code", "joined", "report"])
    expect(all.find((e) => e.kind === "code")?.title).toBe("P1: 1 pull request and 1 commit")
  })

  it("opens the stories for old story links", () => {
    expect(parseShow({})).toBe("all")
    expect(parseShow({ show: "code" })).toBe("code")
    expect(parseShow({ show: "nope" })).toBe("all")
    expect(parseShow({ sort: "important" })).toBe("stories")
  })

  it("names days in UTC", () => {
    expect(dayLabel("2026-11-25", "2026-11-25T23:00:00Z")).toBe("Today")
    expect(dayLabel("2026-11-24", "2026-11-25T00:10:00Z")).toBe("Yesterday")
    expect(dayLabel("2026-11-20", "2026-11-25T00:10:00Z")).toBe("Friday 20 Nov")
  })
})
