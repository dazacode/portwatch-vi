import { describe, expect, it } from "vitest"
import {
  DUPLICATE_AT,
  fingerprintOf,
  hamming,
  similarity,
} from "@/scripts/lib/intel/fingerprint.mjs"

const readme = `# Neptune (Victory Edit)

A GTA VI PC build. Based on VIctory and victory-amd. Window title Neptune.
Runs the prologue at about twelve frames a second on an RTX 5070 Ti.`

describe("fingerprints", () => {
  it("the same repository is the same build", () => {
    const a = fingerprintOf({ repo: "Owner/Repo", name: "Neptune" })
    const b = fingerprintOf({ repo: "owner/repo", name: "Something else" })
    expect(similarity(a, b)).toBe(1)
  })

  it("a renamed copy with the same README is close", () => {
    const a = fingerprintOf({ repo: "a/one", name: "Neptune", readme })
    const b = fingerprintOf({ repo: "b/two", name: "Neptune (Victory Edit)", readme })
    expect(similarity(a, b)).toBeGreaterThanOrEqual(DUPLICATE_AT)
  })

  it("an unrelated build is not", () => {
    const a = fingerprintOf({ repo: "a/one", name: "Neptune", readme })
    const b = fingerprintOf({
      repo: "b/two",
      name: "half-step",
      readme:
        "# half-step\n\nA launcher and shader pack for a different game. Built on D3D12 and Wine.",
    })
    expect(similarity(a, b)).toBeLessThan(DUPLICATE_AT)
  })

  it("hamming counts changed bits", () => {
    expect(hamming("0000000000000000", "0000000000000003")).toBe(2)
  })

  it("an empty build still hashes deterministically", () => {
    expect(fingerprintOf({}).hash).toBe(fingerprintOf({}).hash)
  })
})
