import { describe, expect, it } from "vitest"
import { getBoardEvents, isRecent } from "@/lib/board"
import { cutsIn } from "@/lib/slides"
import type { Project } from "@/lib/standings"

const project = (over: Partial<Project>): Project =>
  ({
    id: "p",
    name: "Project",
    status: "active",
    stage: "Playable",
    rating: 28.6,
    score: 57.1,
    verified: 0,
    isPrivate: false,
    reason: null,
    lastCode: null,
    ...over,
  }) as Project
const effort = (over: object) => ({ id: "p", name: "Project", ...over }) as never
const change = (text: string, kind = "new", date = "2026-11-25") => ({ date, kind, text })
const none = { efforts: [], changes: [] }

describe("getBoardEvents", () => {
  it("announces a join on its date, in our own words", () => {
    const hugo = project({ id: "hugo", name: "MashedHugo", isPrivate: true, status: "private" })
    const changes = [change("MashedHugo joins as a private build at 57.1%: secret details")]
    const [event] = getBoardEvents([hugo], { ...none, changes }, [])
    expect(event).toMatchObject({ kind: "joined", at: "2026-11-25", projectId: "hugo" })
    expect(event.detail).toContain("private build")
    expect(event.detail).not.toContain("secret")
  })

  it("does not take another project's join, or a mention, for its own", () => {
    const changes = [
      change("ProjectX joins the race at 10%"),
      change("Other joins the race, built on Project"),
      change("Project rose 2 pts to 10%.", "up"),
    ]
    expect(getBoardEvents([project({})], { ...none, changes }, [])).toEqual([])
  })

  it("announces a shutdown with its reason, and hides what is hidden", () => {
    const nuked = { at: "2026-11-23", note: "Repo deleted. PortWatch confirmed it." }
    const [event] = getBoardEvents(
      [project({ status: "offline" })],
      { efforts: [effort({ nuked })], changes: [] },
      []
    )
    expect(event).toMatchObject({ kind: "down", at: "2026-11-23", detail: "Repo deleted." })
  })

  it("stays quiet when a project's status is unclear", () => {
    const changes = [change("Project is no longer reachable on GitHub (HTTP 404).", "removed")]
    expect(getBoardEvents([project({ status: "unknown" })], { ...none, changes }, [])).toEqual([])
    expect(getBoardEvents([project({ status: "offline" })], { ...none, changes }, [])).toHaveLength(
      1
    )
  })

  it("dates inactivity from the last code, and skips it without one", () => {
    const quiet = project({
      status: "inactive",
      reason: "Nothing new since 10 Nov",
      lastCode: { at: "2026-11-10T00:00:00Z", kind: "push" },
    })
    expect(getBoardEvents([quiet], none, [])[0].at.slice(0, 10)).toBe("2026-11-17")
    expect(getBoardEvents([{ ...quiet, lastCode: null }], none, [])).toEqual([])
  })

  it("puts the newest first, and the later entry first on the same day", () => {
    const changes = [
      change("Old joins the race", "new", "2026-11-20"),
      change("First joins the race"),
      change("Second joins the race"),
      change("First rises to 64.2%.", "up"),
    ]
    const list = ["Old", "First", "Second"].map((name) => project({ id: name.toLowerCase(), name }))
    const names = getBoardEvents(list, { ...none, changes }, []).map((e) => e.name)
    expect(names).toEqual(["Second", "First", "Old"])
  })
})

it("knows what is recent, and cuts into the show", () => {
  const event = { at: "2026-11-24" } as never
  expect(isRecent(event, 2, Date.parse("2026-11-25T12:00:00Z"))).toBe(true)
  expect(isRecent(event, 2, Date.parse("2026-11-27T12:00:00Z"))).toBe(false)
  expect(cutsIn({ kind: "board" } as never)).toBe(true)
})
