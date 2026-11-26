import { describe, expect, it } from "vitest"
import { chainAll, empty, mergeItems, prune, verifyChain } from "@/scripts/lib/intel/ledger.mjs"

const item = (id: string, at = "2026-11-26T10:00:00Z", status = "held") => ({
  id,
  key: `evidence|x|stage|${Math.floor(Date.parse(at) / 36e5)}`,
  kind: "evidence",
  projectId: "x",
  at,
  detectedAt: at,
  title: id,
  oneLine: "t",
  sources: [{ url: `https://a/${id}`, at, kind: "primary" }],
  fingerprint: { hash: "0" },
  similar: [],
  confidence: { bucket: "moderate", score: 0.5, reasons: [], conflict: false },
  status,
  audit: null,
  chain: "",
  reportId: null,
  discordAt: null,
  revisions: [],
})

describe("merge", () => {
  it("adds a new event once", () => {
    const ledger = { ...empty(), items: [item("a")] }
    expect(
      mergeItems(ledger, [item("b", "2026-11-26T11:10:00Z"), item("b", "2026-11-26T11:10:00Z")])
    ).toHaveLength(1)
  })

  it("drops a replay by key and by id", () => {
    const ledger = { ...empty(), items: [item("a")] }
    expect(mergeItems(ledger, [item("a"), item("a-copy")])).toHaveLength(0)
  })
})

describe("chain", () => {
  it("verifies after a build and fails after a rewrite", () => {
    const ledger = { ...empty(), items: [item("a"), item("b")] }
    chainAll(ledger)
    expect(verifyChain(ledger).ok).toBe(true)
    ledger.items[0].at = "2026-11-26T12:00:00Z"
    expect(verifyChain(ledger).ok).toBe(false)
  })
})

describe("prune", () => {
  it("keeps held items however old, and recent reports", () => {
    const ledger = {
      ...empty(),
      items: [
        item("old", "2020-01-01T00:00:00Z", "held"),
        item("gone", "2020-01-01T00:00:00Z", "published"),
      ],
    }
    const out = prune(ledger, Date.parse("2026-11-26T00:00:00Z"))
    expect(out.items.map((i: { id: string }) => i.id)).toEqual(["old"])
  })
})
