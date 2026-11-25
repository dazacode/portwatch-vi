import { describe, expect, it } from "vitest"
import { span } from "@/lib/format"
import { getDrop } from "@/lib/tracker"

describe("span", () => {
  it("splits the time between two instants", () => {
    const from = Date.parse("2026-11-23T14:36:00Z")
    const to = Date.parse("2026-11-25T01:27:05Z")
    const want = { days: 1, hours: 10, minutes: 51, seconds: 5 }
    expect(span(from, to)).toEqual(want)
    expect(span(to, from)).toEqual(want)
  })
})

describe("getDrop", () => {
  const source = "https://example.com/a"

  it("counts from the release once it is out", () => {
    const exe = {
      status: "released",
      expectedAt: "2026-11-23T17:00:00Z",
      releasedAt: "2026-11-23T14:36:00Z",
      source,
    }
    expect(getDrop({ exe })).toEqual({ at: exe.releasedAt, released: true, source })
  })

  it("counts to the expected time before that", () => {
    const exe = { status: "pending", expectedAt: "2026-11-23T17:00:00Z" }
    expect(getDrop({ exe })).toEqual({ at: exe.expectedAt, released: false, source: null })
  })

  it("is null without a usable date", () => {
    expect(getDrop({ exe: { status: "pending" } })).toBeNull()
    expect(getDrop({ exe: { status: "pending", expected: "soon" } })).toBeNull()
  })
})
