import { describe, expect, it } from "vitest"
import { confidence, seenByPortwatch, verify } from "@/lib/verification.mjs"

const gta = { loads: 1, boots: 1, menu: 1, world: 1, playable: 1, story: 0.6 }

describe("PortWatch's own verification", () => {
  it("counts as one voice up to the furthest stage fully claimed", () => {
    expect(seenByPortwatch({ verification: "portwatch", gta })).toEqual([
      { kind: "portwatch", by: "portwatch", outcome: "reached", stage: "playable" },
    ])
    expect(
      seenByPortwatch({ verification: "portwatch", gta: { ...gta, playable: 0.5 } })[0].stage
    ).toBe("world")
  })

  it("adds nothing for anything else", () => {
    expect(seenByPortwatch({ verification: "self-reported", gta })).toEqual([])
    expect(seenByPortwatch({ verification: "portwatch", gta: { loads: 0.5 } })).toEqual([])
  })

  it("weighs like a live challenge, and alone doesn't verify a stage", () => {
    const voice = seenByPortwatch({ verification: "portwatch", gta })
    expect(confidence(voice, "world")).toBeCloseTo(0.6)
    expect(verify(voice, 86.7).reached).toBeNull()
  })
})
