import { describe, expect, it } from "vitest"
import { intelFeed, jsonFeed } from "@/lib/intel-feed"

const source = {
  url: "https://github.com/a/b/issues/1",
  host: "github.com",
  outlet: "GitHub & co",
  title: "A <report>",
  at: "2026-11-26T10:00:00Z",
  kind: "primary",
}

const item = (id: string, status: string, at: string) => ({
  id,
  kind: "evidence",
  projectId: "x",
  projectName: "X",
  at,
  detectedAt: at,
  title: `Title ${id} & more`,
  oneLine: "One line with 12 fps.",
  sources: [source],
  fingerprint: { hash: "0000000000000000" },
  similar: [],
  confidence: { bucket: "moderate", score: 0.5, reasons: [], conflict: false },
  status,
  audit: null,
  chain: "sha256:x",
  reportId: `${id}-report`,
  discordAt: null,
  revisions: [],
})

const report = (id: string) => ({
  id: `${id}-report`,
  itemId: id,
  publishedAt: "2026-11-26T10:01:00Z",
  by: "rules",
  confidence: "moderate",
  overview: "Overview.",
  changed: "Changed.",
  evidence: "Evidence 12 fps.",
  unknown: "Unknown.",
  sources: [source],
})

const file = {
  updated: "2026-11-26T10:01:00Z",
  baselineAt: "2026-11-20T00:00:00Z",
  coverage: {},
  items: [
    item("a", "published", "2026-11-26T09:00:00Z"),
    item("b", "held", "2026-11-26T10:00:00Z"),
  ],
  reports: [report("a"), report("b")],
} as never

describe("feeds", () => {
  it("carry published entries only", () => {
    expect(intelFeed(file)).toContain("/intelligence/a")
    expect(intelFeed(file)).not.toContain("/intelligence/b")
    expect(jsonFeed(file).items).toHaveLength(1)
  })

  it("escape XML and never emit a raw ampersand", () => {
    const xml = intelFeed(file)
    expect(xml).toContain("GitHub &amp; co")
    expect(xml).toContain("&lt;report&gt;")
    expect(xml).not.toMatch(/GitHub & co/)
  })

  it("says how sure it is", () => {
    expect(jsonFeed(file).items[0].tags).toContain("moderate")
    expect(jsonFeed(file).items[0]._viportlive.sources).toBe(1)
  })
})
