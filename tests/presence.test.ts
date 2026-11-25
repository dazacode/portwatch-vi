import { describe, expect, it } from "vitest"
import { withMe } from "@/components/watching/use-watching"
import { addressTag, crowd, nameOf, pace, parseBeat, presenceOn, watching } from "@/lib/presence"

const id = "abcdefghi1"

describe("who is watching", () => {
  it("is off, and says nothing, without a store", async () => {
    expect(presenceOn).toBe(false)
    expect(await watching()).toEqual({ on: false })
  })

  it("takes only what our own pages send", () => {
    expect(parseBeat({ id, room: "home", wait: 45 })).toEqual({ id, room: "home", wait: 45 })
    expect(parseBeat({ id, room: "twitch:a_b-c", left: "home", gone: true })?.gone).toBe(true)
    for (const bad of [
      null,
      "x",
      {},
      { id: "A!", room: "home" },
      { id, room: "a|b" },
      { id, room: "<b>" },
      { id, room: "home", left: 1 },
    ])
      expect(parseBeat(bad)).toBeNull()
    expect(parseBeat({ id, room: "home", wait: 1e9 })?.wait).toBe(600)
  })

  it("slows down as the crowd grows", () => {
    expect([0, 45, 200, 5000].map(pace)).toEqual([45, 45, 200, 600])
  })

  it("counts each viewer once and limits one address", () => {
    const now = crowd([
      "aa.1|twitch:x",
      "aa.1|home",
      "bb.1|home",
      ...Array.from({ length: 50 }, (_, i) => `cc.${i}|home`),
    ])
    expect(now.total).toBe(7)
    expect(now.rooms).toEqual(Object.assign(Object.create(null), { "twitch:x": 1, home: 6 }))
    expect(now.watchers).toHaveLength(7)
  })

  it("lists a hundred at most, and counts them all", () => {
    const now = crowd(Array.from({ length: 300 }, (_, i) => `${i}.1|home`))
    expect(now.total).toBe(300)
    expect(now.watchers).toHaveLength(100)
  })

  it("counts whoever is reading it, once, where they are", () => {
    const now = crowd(["aa.1|home"])
    const name = now.watchers[0].name
    expect(withMe(now, null, "home")).toBe(now)
    expect(withMe(now, name, "home")).toBe(now)
    expect(withMe(now, "New1", "home")).toMatchObject({ total: 2, rooms: { home: 2 } })
    const moved = withMe(now, name, "twitch:x")
    expect(moved.total).toBe(1)
    expect({ ...moved.rooms }).toEqual({ "twitch:x": 1 })
    expect(moved.watchers).toEqual([{ name, room: "twitch:x" }])
  })

  it("never shows an address, and forgets it by the next day", () => {
    const day = Date.parse("2026-11-25T10:00:00Z")
    const tag = addressTag("203.0.113.7", "s", day)
    expect(tag).not.toContain("203")
    expect(addressTag("203.0.113.7", "s", day + 864e5)).not.toBe(tag)
    expect(nameOf("a.1")).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+\d{1,2}$/)
    expect(nameOf("a.1")).toBe(nameOf("a.1"))
  })
})
