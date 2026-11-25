import { describe, expect, it } from "vitest"
import {
  applyPlan,
  candidatesToReview,
  collectLeads,
  findingBacked,
  parsePlan,
  projectsToReview,
  readmeDigest,
  usedUrls,
} from "@/scripts/lib/editor.mjs"

const now = Date.parse("2026-11-25T12:00:00Z")
const since = now - 6 * 3600_000

const lead = (title: string, url: string, date = "2026-11-25T11:00:00Z") => ({
  title,
  url,
  outlet: "Outfit",
  date,
})

const efforts = [
  { id: "alpha", name: "Alpha", repo: "one/alpha", findings: [], gta: {} },
  { id: "beta", name: "Beta", repo: "two/beta", findings: [], gta: {} },
]

const good = {
  note: "one finding",
  findings: [{ project: "alpha", text: "Zettrox title bar reads 4 fps", lead: "L1" }],
}

describe("collectLeads", () => {
  it("keeps only recent https leads and gives them ids", () => {
    const rows = collectLeads({
      news: {
        items: [
          lead("Fresh", "https://a.test/1"),
          lead("Plain", "http://a.test/2"),
          lead("Old", "https://a.test/3", "2026-11-20T00:00:00Z"),
          lead("Fresh again", "https://a.test/1/"),
        ],
      },
      tracker: {},
      since,
      now,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: "L1", title: "Fresh", url: "https://a.test/1" })
  })

  it("skips URLs we already cite", () => {
    const rows = collectLeads({
      news: { items: [lead("Fresh", "https://a.test/1")] },
      tracker: {},
      usedUrls: new Set(["https://a.test/1"]),
      since,
      now,
    })
    expect(rows).toHaveLength(0)
  })
})

describe("readmeDigest", () => {
  it("flattens markdown and caps the length", () => {
    const text = readmeDigest(
      "<h1>Title</h1>\n\n![shot](x.png)\n\n**bold** and [link](https://a.test)"
    )
    expect(text).toContain("Title")
    expect(text).not.toContain("<h1>")
    expect(text).not.toContain("x.png")
    expect(text.length).toBeLessThanOrEqual(1200)
  })
})

describe("projectsToReview", () => {
  it("takes moved READMEs, open claims and named projects", () => {
    const rows = projectsToReview({
      tracker: {
        efforts: [
          { ...efforts[0], readmeChangedAt: "2026-11-25T11:30:00Z", claims: [] },
          {
            ...efforts[1],
            readmeChangedAt: "2026-11-20T00:00:00Z",
            claims: [{ at: "2026-11-25T11:00:00Z" }],
          },
        ],
      },
      overrides: { added: [] },
      leads: [lead("Beta news", "https://a.test/1")],
      since,
    })
    expect(rows.map((r: { id: string }) => r.id).sort()).toEqual(["alpha", "beta"])
  })
})

describe("candidatesToReview", () => {
  it("drops decided and ignored repos", () => {
    const rows = candidatesToReview({
      tracker: {
        candidates: [
          { repo: "a/one", status: "new" },
          { repo: "b/two", status: "new" },
          { repo: "c/three", status: "new" },
          { repo: "d/four", status: "old" },
        ],
      },
      overrides: { decided: ["a/one"], ignored: [{ repo: "b/two" }] },
    })
    expect(rows.map((r: { repo: string }) => r.repo)).toEqual(["c/three"])
  })
})

describe("usedUrls", () => {
  it("collects findings and article sources", () => {
    const urls = usedUrls(
      [{ findings: [{ url: "https://a.test/1" }] }],
      [{ sources: [{ url: "https://a.test/2" }] }]
    )
    expect([...urls].sort()).toEqual(["https://a.test/1", "https://a.test/2"])
  })
})

describe("findingBacked", () => {
  it("refuses a text with no word in common", () => {
    expect(
      findingBacked("Completely unrelated words here", lead("Zettrox no crashes", "https://a.test"))
    ).toBe(false)
    expect(
      findingBacked(
        "Zettrox ran an hour without crashes",
        lead("Zettrox no crashes", "https://a.test")
      )
    ).toBe(true)
  })
})

describe("parsePlan", () => {
  it("accepts a minimal plan and fills empty lists", () => {
    const parsed = parsePlan(JSON.stringify(good))
    expect(parsed.ok).toBe(true)
    // @ts-expect-error narrowed by ok
    expect(parsed.plan.scores).toEqual([])
  })

  it("refuses a wrong category and a bad shape", () => {
    expect(
      parsePlan(
        `{"articles":[{"title":"t","dek":"d","category":"News","body":["a","b"],"sourceLeads":["L1"]}]}`
      ).ok
    ).toBe(false)
    expect(parsePlan("not json").ok).toBe(false)
  })
})

describe("applyPlan", () => {
  const leads = [
    {
      id: "L1",
      title: "Zettrox no crashes",
      url: "https://a.test/1",
      outlet: "Outfit",
      date: "2026-11-25",
    },
  ]
  const findingsByProject = new Map([["alpha", []]])

  function fake(overrides: Record<string, unknown> = {}) {
    const calls: string[][] = []
    const pw = async (args: string[]) => {
      calls.push(args)
      if (args.includes("check")) return { ok: true }
      if (args.includes("--dry-run") && args[0] === "set") {
        return { ok: true, data: { delta: "delta" in overrides ? overrides.delta : 1 } }
      }
      return { ok: true, data: {} }
    }
    return { pw, calls }
  }

  it("writes through dry run first and cites the lead URL", async () => {
    const { pw, calls } = fake()
    const result = await applyPlan(good as never, {
      pw,
      efforts,
      leads,
      findingsByProject,
      today: "2026-11-25",
    })
    expect(result.applied).toHaveLength(1)
    expect(calls[0]).toContain("--dry-run")
    expect(calls[1]).toContain("https://a.test/1")
  })

  it("skips a finding whose lead is not in the brief", async () => {
    const { pw } = fake()
    const result = await applyPlan(
      { ...good, findings: [{ project: "alpha", text: "Something", lead: "L9" }] } as never,
      {
        pw,
        efforts,
        leads,
        findingsByProject,
        today: "2026-11-25",
      }
    )
    expect(result.applied).toHaveLength(0)
    expect(result.skipped[0]).toContain("not in the brief")
  })

  it("skips a falling score unless the claim was withdrawn", async () => {
    const { pw } = fake({ delta: -2 })
    const plan = { scores: [{ project: "alpha", fields: { "gta.fps": 2 } }] }
    const first = await applyPlan(plan as never, {
      pw,
      efforts,
      leads,
      findingsByProject,
      today: "2026-11-25",
    })
    expect(first.applied).toHaveLength(0)
    expect(first.skipped[0]).toContain("withdrawn")
    const second = await applyPlan({ scores: [{ ...plan.scores[0], withdrawn: true }] } as never, {
      pw,
      efforts,
      leads,
      findingsByProject,
      today: "2026-11-25",
    })
    expect(second.applied[0]).toContain("score alpha")
  })

  it("refuses an article outside 120 to 220 words", async () => {
    const { pw } = fake()
    const plan = {
      articles: [
        {
          title: "T",
          dek: "D",
          category: "Port",
          body: ["Short.", "Also short."],
          sourceLeads: ["L1"],
        },
      ],
    }
    const result = await applyPlan(plan as never, {
      pw,
      efforts,
      leads,
      findingsByProject,
      today: "2026-11-25",
    })
    expect(result.skipped[0]).toContain("120")
  })

  it("writes an article that meets the shape", async () => {
    const calls: string[][] = []
    const pw = async (args: string[]) => {
      calls.push(args)
      return { ok: true, data: {} }
    }
    const para = (word: string) => Array.from({ length: 70 }, () => word).join(" ")
    await applyPlan(
      {
        articles: [
          {
            title: "Wave hits repos",
            dek: "Many repos went.",
            category: "Takedown",
            body: [para("one"), para("two")],
            sourceLeads: ["L1"],
          },
        ],
      } as never,
      { pw, efforts, leads, findingsByProject, today: "2026-11-25" }
    )
    const real = calls.at(-1) ?? []
    expect(real.slice(0, 3)).toEqual(["news", "add", "--title"])
    expect(real.filter((a) => a === "--body")).toHaveLength(2)
    expect(real.filter((a) => a === "--source")).toHaveLength(1)
    expect(real.join(" ")).toContain("https://a.test/1")
  })

  it("skips a track with no effort object", async () => {
    const { pw } = fake()
    const result = await applyPlan(
      { candidates: [{ repo: "new/repo", action: "track", reason: "why" }] } as never,
      {
        pw,
        efforts,
        leads,
        findingsByProject,
        today: "2026-11-25",
      }
    )
    expect(result.skipped[0]).toContain("effort object")
  })

  it("writes an effort file for a track and drops an empty gta", async () => {
    const { readFile } = await import("node:fs/promises")
    let written: Record<string, unknown> = {}
    const pw = async (args: string[]) => {
      if (args[1] === "track") written = JSON.parse(await readFile(args[4], "utf8"))
      return { ok: true, data: {} }
    }
    await applyPlan(
      {
        candidates: [
          {
            repo: "new/repo",
            action: "track",
            reason: "why",
            effort: { name: "New", summary: "One.", gta: {} },
          },
        ],
      } as never,
      { pw, efforts, leads, findingsByProject, today: "2026-11-25" }
    )
    expect(written.id).toBe("repo")
    expect(written.gta).toBe(undefined)
  })

  it("never writes in dry mode", async () => {
    const calls: string[][] = []
    const pw = async (args: string[]) => {
      calls.push(args)
      return { ok: true, data: { delta: 1 } }
    }
    const result = await applyPlan(good as never, {
      pw,
      efforts,
      leads,
      findingsByProject: new Map([["alpha", []]]),
      today: "2026-11-25",
      dry: true,
    })
    expect(result.applied).toHaveLength(1)
    expect(calls.every((args) => args.includes("--dry-run"))).toBe(true)
  })
})
