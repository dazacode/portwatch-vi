import { describe, expect, it } from "vitest"
import { HOLIDAYS, type Holiday, holidayScript } from "@/lib/holidays"

/** Runs the inline script against a page, as a browser would. */
function run(date: Date, saved: string | null = null, holidays?: readonly Holiday[]) {
  const dataset: Record<string, string> = {}
  const page = { documentElement: { dataset } }
  const storage = { getItem: () => saved }
  class Now extends Date {
    constructor() {
      super(date)
    }
  }
  new Function("document", "localStorage", "Date", holidayScript(holidays))(page, storage, Now)
  return dataset
}

describe("holidays", () => {
  it.each([
    [new Date(2026, 10, 23, 23, 59), null],
    [new Date(2026, 10, 24, 0, 0), "thanksgiving"],
    [new Date(2026, 10, 26, 12), "thanksgiving"],
    [new Date(2026, 10, 29, 23, 59), "thanksgiving"],
    [new Date(2026, 10, 30, 0, 0), null],
    [new Date(2027, 10, 26), null],
  ])("on %s it is %s", (date, id) => {
    expect(run(date).season ?? null).toBe(id)
    expect(run(date).holiday ?? null).toBe(id)
  })
  it("stays off for someone who turned it off, and can be turned on again", () => {
    expect(run(new Date(2026, 10, 26), "off")).toEqual({ season: "thanksgiving" })
    expect(run(new Date(2026, 10, 26), "on").holiday).toBe("thanksgiving")
  })
  it("is off for everybody when it is switched off in the code", () => {
    const off = HOLIDAYS.map((h) => ({ ...h, on: false }))
    expect(run(new Date(2026, 10, 26), null, off)).toEqual({})
  })
})
