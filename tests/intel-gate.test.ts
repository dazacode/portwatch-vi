import { describe, expect, it } from "vitest"
import { assess, auditOutcome, eventKey, gate, independence } from "@/lib/intel-gate.mjs"

const source = (kind: string, outlet = "GitHub", authorHash = outlet) => ({
  url: `https://${outlet.toLowerCase()}.example/a`,
  host: `${outlet.toLowerCase()}.example`,
  outlet,
  title: "t",
  at: "2026-11-26T10:00:00Z",
  kind,
  authorHash,
})

const item = (sources: any[], extra: Record<string, unknown> = {}) => ({
  kind: "evidence",
  projectId: "x",
  sources,
  confidence: assess({ sources: sources as never }),
  ...extra,
})

describe("independence", () => {
  it("counts a repost and the same author once", () => {
    expect(
      independence([source("outside", "A", "one"), source("repost", "B", "one")])
    ).toHaveLength(1)
  })
  it("keeps two different voices", () => {
    expect(
      independence([source("outside", "A", "one"), source("outside", "B", "two")])
    ).toHaveLength(2)
  })
})

describe("confidence", () => {
  it("a social post alone is low", () => {
    expect(assess({ sources: [source("outside")] }).bucket).toBe("low")
  })
  it("a project repo plus an outside report is moderate", () => {
    expect(
      assess({ sources: [source("primary", "GitHub", "p"), source("outside", "Outfit", "o")] })
        .bucket
    ).toBe("moderate")
  })
  it("three outside sources and a repo is high", () => {
    const sources = [
      source("primary", "GitHub", "p"),
      source("outside", "A", "a"),
      source("outside", "B", "b"),
      source("outside", "C", "c"),
    ]
    expect(assess({ sources }).bucket).toBe("high")
  })
  it("a disagreement keeps it low", () => {
    const sources = [
      source("primary", "GitHub", "p"),
      source("outside", "A", "a"),
      source("outside", "B", "b"),
    ]
    expect(assess({ sources, conflict: true }).bucket).toBe("low")
  })
  it("a record already read can reach moderate alone", () => {
    expect(assess({ sources: [source("primary")], corroborated: true }).bucket).toBe("moderate")
  })
})

describe("gate", () => {
  it("publishes moderate and holds low", () => {
    expect(gate(item([source("primary", "GitHub", "p"), source("outside", "A", "a")])).status).toBe(
      "published"
    )
    expect(gate(item([source("outside")])).status).toBe("held")
  })
  it("holds duplicates, gaps, disagreements and sensitive claims", () => {
    const good = [source("primary", "GitHub", "p"), source("outside", "A", "a")]
    expect(gate(item(good, { kind: "duplicate" })).status).toBe("held")
    expect(gate(item(good), { openGap: true }).status).toBe("held")
    expect(gate(item(good, { confidence: { bucket: "moderate", conflict: true } })).status).toBe(
      "held"
    )
    expect(gate(item(good, { kind: "claim", sensitive: true })).status).toBe("held")
  })
  it("never publishes without an https source", () => {
    expect(
      gate(item([{ ...source("primary"), url: "http://a" }, source("outside", "A", "a")])).status
    ).toBe("held")
  })
})

describe("event key", () => {
  it("is stable inside half a day and changes across it", () => {
    const a = eventKey({ kind: "update", projectId: "x", url: "u", at: "2026-11-26T01:00:00Z" })
    const b = eventKey({ kind: "update", projectId: "x", url: "u", at: "2026-11-26T04:00:00Z" })
    const c = eventKey({ kind: "update", projectId: "x", url: "u", at: "2026-11-26T14:00:00Z" })
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })
})

describe("audit outcomes", () => {
  it("only makes the record more cautious", () => {
    expect(auditOutcome("dead-link").status).toBeNull()
    expect(auditOutcome("unsupported").status).toBe("held")
    expect(auditOutcome("contradicted").status).toBe("retracted")
  })
})
