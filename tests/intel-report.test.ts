import { describe, expect, it } from "vitest"
import { sectionProblems, skeleton } from "@/scripts/lib/intel/report.mjs"

const item = (kind: string, excerpt = "The world renders lit at 7.5 fps.") => ({
  kind,
  projectName: "X",
  oneLine: excerpt,
  confidence: { bucket: "moderate", conflict: false, reasons: [] },
  sources: [
    {
      url: "https://github.com/a/b/issues/1",
      host: "github.com",
      outlet: "GitHub",
      title: "A report",
      at: "2026-11-26T10:00:00Z",
      kind: "primary",
      excerpt,
    },
  ],
})

describe("skeleton", () => {
  it.each([
    "reference",
    "update",
    "evidence",
    "claim",
    "takedown",
    "duplicate",
    "audit",
    "ingest-gap",
  ])("is publishable for %s", (kind) => {
    expect(sectionProblems(skeleton(item(kind)), item(kind).sources)).toEqual([])
  })

  it("keeps a quote to two sentences", () => {
    const long = item("evidence", "One. Two. Three. Four.")
    const text = skeleton(long).evidence
    expect(text.match(/[.!?](?:\s|$)/g)?.length).toBeLessThanOrEqual(4)
  })

  it("never claims authenticity", () => {
    expect(skeleton(item("evidence")).unknown).toContain("authenticity is not established")
  })
})

describe("section checks", () => {
  it("rejects a number that is not in a source", () => {
    const sections = skeleton(item("evidence"))
    sections.changed = `${sections.changed} It rose by 99 points.`
    expect(sectionProblems(sections, item("evidence").sources).join(" ")).toContain("99")
  })

  it("rejects a link", () => {
    const sections = skeleton(item("evidence"))
    sections.overview = `${sections.overview} See https://example.com.`
    expect(sectionProblems(sections, item("evidence").sources).join(" ")).toContain("link")
  })
})
