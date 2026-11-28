import { describe, expect, it } from "vitest"
import { rejectedRepos } from "@/lib/tracker"

describe("rejectedRepos", () => {
  it("collects ignored and flagged repos, case-folded", () => {
    const set = rejectedRepos({
      ignored: [{ repo: "Lure/Repo" }, {}],
      flagged: [{ members: ["Copy/One", { repo: "Copy/Two" }] }, {}],
    })
    expect([...set].sort()).toEqual(["copy/one", "copy/two", "lure/repo"])
  })

  it("is empty without lists", () => {
    expect(rejectedRepos({}).size).toBe(0)
  })
})
