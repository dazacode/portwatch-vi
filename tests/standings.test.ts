import { describe, expect, it } from "vitest"
import type { Milestone } from "@/lib/milestones"
import {
  applyFilters,
  getLastCode,
  getOrigin,
  getProjects,
  getStatus,
  groupProjects,
  NO_FILTERS,
  parseFilters,
  toEntry,
  toQuery,
} from "@/lib/standings"
import {
  type ActivityCommit,
  type Effort,
  getActivity,
  getEvidence,
  getMilestones,
  getStandings,
  getTracker,
  type Tracker,
} from "@/lib/tracker"

const CHECKED = "2026-11-24T22:00:00Z"

const effort = (patch: Partial<Effort> = {}): Effort => ({
  id: "a",
  name: "Alpha",
  repo: "someone/alpha",
  tier: "tracked",
  summary: "",
  blockers: [],
  verification: "self-reported",
  gta: { loads: 0, boots: 0, menu: 0, world: 0, playable: 0, fps: 0 },
  stats: {},
  ...patch,
})

const commit = (at: string) => ({ at }) as ActivityCommit

function sources({
  efforts = [] as Effort[],
  changes = [] as Tracker["changes"],
  news = [] as Partial<Tracker["news"][number]>[],
  milestones = [] as Pick<Milestone, "id" | "at">[],
  commits = {} as Record<string, string[]>,
} = {}) {
  return {
    tracker: {
      efforts,
      changes,
      news: news.map((n) => ({ title: "", dek: "", body: [], ...n })) as Tracker["news"],
      scout: { lastRun: CHECKED },
    },
    activity: {
      updated: "2026-11-25T01:00:00Z",
      projects: Object.fromEntries(
        Object.entries(commits).map(([id, list]) => [
          id,
          { openPrs: 0, pulls: [], commits: list.map(commit) },
        ])
      ),
    },
    milestones,
    evidence: [],
  }
}

const statusOf = (e: Effort, s = sources(), isPrivate = false) => getStatus(e, isPrivate, s)

describe("origin", () => {
  const changes = [
    { date: "2026-11-24", kind: "new", text: "Alpha joins." },
    { date: "2026-11-22", kind: "new", text: "Scout spotted someone/alpha (possible effort)." },
    { date: "2026-11-20", kind: "new", text: "Alphabet and other/Alpha and Alpha-two appear." },
  ]
  it("prefers the day the repo was created", () => {
    const e = effort({ stats: { createdAt: "2026-11-23T10:00:00Z" } })
    expect(getOrigin(e, sources({ changes }))).toEqual({
      at: "2026-11-23T10:00:00Z",
      kind: "github",
    })
  })
  it("falls back to the first mention of the whole name or repo", () => {
    expect(getOrigin(effort(), sources({ changes }))).toEqual({
      at: "2026-11-22",
      kind: "mentioned",
    })
  })
  it("reads articles and milestones too", () => {
    const news = [{ date: "2026-11-21", body: ["A story about Alpha's build."] }]
    expect(getOrigin(effort(), sources({ changes, news }))?.at).toBe("2026-11-21")
    const milestones = [{ id: "a", at: "2026-11-19T10:00:00Z" }]
    expect(getOrigin(effort(), sources({ changes, milestones }))?.at).toBe("2026-11-19T10:00:00Z")
  })
  it("is unknown without either", () => {
    expect(getOrigin(effort({ name: "Beta", repo: null }), sources({ changes }))).toBeNull()
    expect(getOrigin(effort({ stats: { createdAt: "soon" } }), sources())).toBeNull()
  })
  it("copes with names that are special in a pattern", () => {
    const text = "C++ (port) arrives."
    const s = sources({ changes: [{ date: "2026-11-24", kind: "new", text }] })
    expect(getOrigin(effort({ name: "C++ (port)", repo: null }), s)?.at).toBe("2026-11-24")
  })
})

describe("last code", () => {
  it("takes the newer of the push and the commits, and ignores commits from the future", () => {
    const e = effort({ stats: { pushedAt: "2026-11-23T10:00:00Z" } })
    expect(getLastCode(e, sources())).toEqual({ at: "2026-11-23T10:00:00Z", kind: "push" })
    const commits = { a: ["2026-11-24T10:00:00Z", "2027-01-01T00:00:00Z"] }
    expect(getLastCode(e, sources({ commits }))).toEqual({
      at: "2026-11-24T10:00:00Z",
      kind: "commit",
    })
    expect(getLastCode(effort(), sources())).toBeNull()
  })
})

describe("status", () => {
  it("is inactive after more than 7 days without anything new, and not before", () => {
    expect(statusOf(effort({ stats: { pushedAt: "2026-11-17T22:00:00Z" } })).status).toBe("active")
    expect(statusOf(effort({ stats: { pushedAt: "2026-11-17T21:59:59Z" } })).status).toBe(
      "inactive"
    )
    const s = sources({ commits: { a: ["2026-11-24T10:00:00Z"] } })
    expect(statusOf(effort({ stats: { pushedAt: "2026-11-01T00:00:00Z" } }), s).status).toBe(
      "active"
    )
  })
  it("never calls unknown activity or a private build dead", () => {
    expect(statusOf(effort()).status).toBe("unknown")
    expect(statusOf(effort({ stats: { commits7d: null } })).status).toBe("unknown")
    expect(statusOf(effort({ repo: null }), sources(), true).status).toBe("private")
  })
  it("puts archived repos with the inactive", () => {
    const stats = { archived: true, pushedAt: CHECKED }
    expect(statusOf(effort({ stats }))).toEqual({
      status: "inactive",
      reason: "Archived on GitHub",
    })
  })
  it("says why a project is offline", () => {
    const nuked = { at: "2026-11-23", note: "" }
    expect(statusOf(effort({ nuked }))).toEqual({
      status: "offline",
      reason: "Taken offline on 23 Nov",
    })
    const stats = { missing: true, missingStatus: 404, pushedAt: "2026-11-23T10:00:00Z" }
    const old = sources({ commits: { a: ["2026-11-23T10:00:00Z"] } })
    expect(statusOf(effort({ stats }), old)).toEqual({
      status: "offline",
      reason: "Repo not reachable: GitHub answered 404 on 24 Nov",
    })
  })
  it("leaves a repo open when commits were read after it went missing", () => {
    const stats = { missing: true, missingStatus: 404 }
    const s = sources({ commits: { a: ["2026-11-25T00:30:00Z"] } })
    expect(statusOf(effort({ stats }), s).status).toBe("unknown")
  })
})

describe("the board", () => {
  it("ranks public projects that are up, in the order of getStandings", async () => {
    const [tracker, evidence, activity, milestones] = await Promise.all([
      getTracker(),
      getEvidence(),
      getActivity(),
      getMilestones(),
    ])
    const standings = getStandings(tracker, evidence)
    const projects = getProjects(standings, { tracker, evidence, activity, milestones })
    const order = standings.map((s) => s.id)
    const ranked = projects.filter((p) => p.rank !== null)

    expect(projects.map((p) => p.id).sort()).toEqual([...order].sort())
    expect(ranked.map((p) => p.rank)).toEqual(ranked.map((_, i) => i + 1))
    expect(ranked.map((p) => p.id)).toEqual(order.filter((id) => ranked.some((p) => p.id === id)))
    expect(ranked.some((p) => p.isPrivate || p.nuked)).toBe(false)

    const g = groupProjects(projects)
    expect([g.podium.length, g.top5.length, g.top10.length]).toEqual([3, 2, 5])
    const all = [g.podium, g.top5, g.top10, g.rest, g.private, g.gone].flat()
    expect(all.map((p) => p.id)).toEqual(projects.map((p) => p.id))
  })

  it("ranks private builds with the rest only when asked to", async () => {
    const [tracker, evidence, activity, milestones] = await Promise.all([
      getTracker(),
      getEvidence(),
      getActivity(),
      getMilestones(),
    ])
    const standings = getStandings(tracker, evidence)
    const sources = { tracker, evidence, activity, milestones }
    const usual = getProjects(standings, sources)
    const everyone = getProjects(standings, sources, { withPrivate: true })
    const ranked = everyone.filter((p) => p.rank !== null)
    // The one we place first ourselves is not in score order, and says so.
    const pick = tracker.pick?.id
    expect(ranked[0].id).toBe(pick)
    expect(ranked.filter((p) => p.pick).map((p) => p.id)).toEqual([pick])
    expect(usual.every((p) => p.pick === null)).toBe(true)
    const scores = ranked.slice(1).map((p) => p.rating)

    expect(everyone.map((p) => p.id).sort()).toEqual(usual.map((p) => p.id).sort())
    expect(ranked.map((p) => p.rank)).toEqual(ranked.map((_, i) => i + 1))
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
    expect(everyone.filter((p) => p.status === "private").every((p) => p.rank !== null)).toBe(true)
    expect(ranked.some((p) => p.nuked)).toBe(false)
    expect(groupProjects(everyone).private).toEqual([])
    const all = Object.values(groupProjects(everyone)).flat()
    expect(all.map((p) => p.id).sort()).toEqual(everyone.map((p) => p.id).sort())
  })

  it("keeps the choice of ranks in the address", () => {
    const everyone = { ...NO_FILTERS, ranks: "everyone" as const }
    expect(toQuery(everyone)).toBe("ranks=everyone")
    expect(parseFilters(new URLSearchParams("ranks=everyone"))).toEqual(everyone)
    expect(parseFilters(new URLSearchParams("ranks=nonsense"))).toEqual(NO_FILTERS)
  })
})

describe("filters", () => {
  const make = (id: string, patch: Partial<Effort>, name = id) => effort({ id, name, ...patch })
  const efforts = [
    make("a", { stats: { stars: 5, commits7d: 100, createdAt: "2026-11-20T20:00:00Z" } }, "Alpha"),
    make("b", { stats: { stars: 9, createdAt: "2026-11-20T08:00:00Z" }, repo: "x/b" }),
    make("c", { repo: null }),
    make("d", {
      repo: "x/d",
      nuked: { at: "2026-11-23", note: "" },
      stats: { createdAt: "2026-11-22T00:00:00Z" },
    }),
  ]
  const s = sources({ efforts })
  const entries = getProjects(getStandings({ efforts } as Tracker, []), s).map(toEntry)
  const ids = (patch: object) => applyFilters(entries, { ...NO_FILTERS, ...patch }).map((e) => e.id)

  it("keeps every project's true rank", () => {
    expect(entries.map((e) => [e.id, e.rank])).toEqual([
      ["b", 1],
      ["a", 2],
      ["c", null],
      ["d", null],
    ])
    expect(applyFilters(entries, { ...NO_FILTERS, q: "alph" })[0].rank).toBe(2)
  })
  it("searches names and repos", () => {
    expect(ids({ q: " ALPHA " })).toEqual(["a"])
    expect(ids({ q: "x/" })).toEqual(["b", "d"])
    expect(ids({ q: "nothing" })).toEqual([])
  })
  it("filters by stage, status and code", () => {
    expect(ids({ stage: "groundwork" })).toHaveLength(4)
    expect(ids({ stage: "menu" })).toEqual([])
    expect(ids({ status: "offline" })).toEqual(["d"])
    expect(ids({ status: "private" })).toEqual(["c"])
    expect(ids({ code: "private" })).toEqual(["c"])
    expect(ids({ code: "public" })).toEqual(["b", "a", "d"])
  })
  it("sorts with unknown values last and ties in rank order", () => {
    expect(ids({ sort: "stars" })).toEqual(["b", "a", "c", "d"])
    expect(ids({ sort: "commits" })).toEqual(["a", "b", "c", "d"])
    expect(ids({ sort: "newest" })).toEqual(["d", "b", "a", "c"])
    expect(ids({ sort: "oldest" })).toEqual(["b", "a", "d", "c"])
  })
  it("survives a round trip through the address, and ignores what it doesn't know", () => {
    const f = { ...NO_FILTERS, q: "a&b", status: "offline", sort: "stars" } as const
    expect(parseFilters(new URLSearchParams(toQuery(f)))).toEqual(f)
    expect(toQuery(NO_FILTERS)).toBe("")
    const bad = new URLSearchParams("stage=moon&status=dead&code=x&sort=toString")
    expect(parseFilters(bad)).toEqual(NO_FILTERS)
  })
})
