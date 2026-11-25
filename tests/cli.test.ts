import { execFile } from "node:child_process"
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { beforeEach, describe, expect, it } from "vitest"

const CLI = fileURLToPath(new URL("../scripts/pw.mjs", import.meta.url))
const LAUNCHER = fileURLToPath(new URL("../pw", import.meta.url))

const words = (n: number, word = "word") =>
  Array.from({ length: n }, (_, i) => `${word}${i}`).join(" ")

const article = {
  id: "2026-01-01-old",
  date: "2026-01-01",
  category: "Port",
  title: "An old article",
  dek: "Something happened.",
  body: ["First paragraph of the old article.", "Second paragraph of the old article."],
  sources: [{ outlet: "PortWatch VI", title: "The race", url: "#race" }],
  image: null,
  by: "PortWatch",
}

const effort = (id: string, name: string, repo: string) => ({
  id,
  name,
  repo,
  tier: "tracked",
  summary: `${name} summary.`,
  highlights: [],
  blockers: [],
  gta: {
    loads: 0,
    boots: 0,
    menu: 0,
    world: 0,
    playable: 0,
    story: 0,
    render: 0,
    fps: 0,
    stability: "unknown",
  },
  verification: "self-reported",
  stats: {},
  assessedAt: "2026-01-01",
  assessedBy: "manual",
  claims: [],
})

let root: string
let data: string
let overridesFile: string

type Ran = { code: number; stdout: string; stderr: string }

async function call(
  args: string[],
  { env = {} }: { env?: Record<string, string> } = {}
): Promise<Ran> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [CLI, "--data", data, "--root", root, ...args],
      { env: { ...process.env, NO_COLOR: "1", ...env } },
      (err, stdout, stderr) => resolve({ code: Number(err?.code ?? 0), stdout, stderr })
    )
  })
}

const json = (result: Ran) => JSON.parse(result.stdout)

async function callLauncher(args: string[]): Promise<Ran> {
  return new Promise((resolve) => {
    execFile(LAUNCHER, ["--data", data, "--root", root, ...args], (err, stdout, stderr) =>
      resolve({ code: Number(err?.code ?? 0), stdout, stderr })
    )
  })
}
const readOverrides = async () => JSON.parse(await readFile(overridesFile, "utf8"))

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "pw-"))
  data = path.join(root, "data")
  await mkdir(data, { recursive: true })
  overridesFile = path.join(data, "overrides.json")
  const tracker = {
    updated: "2026-01-02T00:00:00.000Z",
    exe: { status: "soon", expectedAt: "2027-01-01" },
    news: [article],
    efforts: [
      effort("alpha", "Alpha Port", "one/alpha"),
      effort("beta", "Shared Port", "two/beta"),
      effort("gamma", "Shared Port Two", "three/gamma"),
    ],
    tools: [],
    candidates: [
      {
        repo: "new/repo",
        name: "Repo",
        kind: "effort",
        status: "new",
        stars: 2,
        description: "A candidate.",
      },
      {
        repo: "other/repo",
        name: "Other",
        kind: "tool",
        status: "new",
        stars: 1,
        description: "Another.",
      },
    ],
    flagged: [],
    ignored: [],
    changes: [],
    history: [],
    headlines: [],
    dmca: [],
    scout: { lastRun: "2026-01-02T00:00:00.000Z" },
  }
  const evidence = {
    items: [
      {
        effortId: "alpha",
        kind: "tester",
        outcome: "reached",
        stage: "loads",
        quote: "it loads",
        commit: null,
        gpu: null,
        url: "https://example.com/e",
        at: "2026-01-01",
        by: "aaaa",
      },
    ],
  }
  await writeFile(path.join(data, "tracker.json"), JSON.stringify(tracker, null, 2))
  await writeFile(overridesFile, JSON.stringify({ patches: [], added: [], pick: null }, null, 2))
  await writeFile(path.join(data, "evidence.json"), JSON.stringify(evidence, null, 2))
})

describe("pw read commands", () => {
  it("returns a status envelope with counts", async () => {
    const result = await call(["status", "--json"])
    expect(result.code).toBe(0)
    const body = json(result)
    expect(body.ok).toBe(true)
    expect(body.data.counts.projects).toBe(3)
    expect(body.data.counts.candidates).toBe(2)
  })

  it("keeps stdout JSON clean through the ./pw launcher", async () => {
    const result = await callLauncher(["status", "--json"])
    expect(result.code).toBe(0)
    expect(json(result).ok).toBe(true)
    expect(result.stdout.trimStart().startsWith("{")).toBe(true)
  })

  it("lists only matching projects", async () => {
    const result = await call(["list", "--query", "alpha", "--json"])
    expect(result.code).toBe(0)
    expect(json(result).data.projects.map((p: { id: string }) => p.id)).toEqual(["alpha"])
  })

  it("shows one project and its score parts", async () => {
    const result = await call(["show", "beta", "--json"])
    expect(result.code).toBe(0)
    expect(json(result).data.project.id).toBe("beta")
    expect(json(result).data.view).toBeDefined()
  })

  it("previews a value without writing", async () => {
    const before = await readFile(overridesFile, "utf8")
    const result = await call(["score", "alpha", "--set", "gta.loads=1", "--json"])
    expect(result.code).toBe(0)
    expect(json(result).data.after.claimed).toBeGreaterThan(0)
    expect(await readFile(overridesFile, "utf8")).toBe(before)
  })

  it("refuses an ambiguous name with candidates", async () => {
    const result = await call(["show", "shared", "--json"])
    expect(result.code).toBe(2)
    expect(json(result).error.code).toBe("ambiguous_project")
    expect(json(result).error.data.candidates).toHaveLength(2)
  })

  it("promotes a candidate from a JSON file", async () => {
    const file = path.join(root, "effort.json")
    await writeFile(
      file,
      JSON.stringify({
        id: "promoted",
        name: "Promoted",
        summary: "A promoted candidate.",
        blockers: [],
        gta: {
          loads: 0,
          boots: 0,
          menu: 0,
          world: 0,
          playable: 0,
          story: 0,
          render: 0,
          fps: 0,
          stability: "unknown",
        },
      })
    )
    const result = await call(["candidate", "track", "new/repo", "--file", file, "--json"])
    expect(result.code).toBe(0)
    const added = (await readOverrides()).added[0].effort
    expect(added.id).toBe("promoted")
    expect(added.repo).toBe("new/repo")
    expect(added.stats.stars).toBe(2)
    expect((await call(["check", "--json"])).code).toBe(0)
  })

  it("tracks a repo upstream ignored, with a warning and no stats", async () => {
    const trackerFile = path.join(data, "tracker.json")
    const tracker = JSON.parse(await readFile(trackerFile, "utf8"))
    tracker.ignored = [{ repo: "old/repo", reason: "a copy", seenAt: "2026-01-01" }]
    await writeFile(trackerFile, JSON.stringify(tracker, null, 2))
    const file = path.join(root, "effort.json")
    await writeFile(file, JSON.stringify({ id: "old", name: "Old", summary: "Listed by us." }))
    const result = await call(["candidate", "track", "old/repo", "--file", file, "--json"])
    expect(result.code).toBe(0)
    expect(json(result).warnings.join()).toContain("a copy")
    const added = (await readOverrides()).added[0].effort
    expect(added.repo).toBe("old/repo")
    expect(added.stats.stars).toBe(null)
    expect((await call(["check", "--json"])).code).toBe(0)
  })

  it("reaches a goal only with linked evidence", async () => {
    const claim = ["loads", "boots", "menu", "world", "playable"].map((k) => `gta.${k}=1`)
    await call(["set", "alpha", ...claim, "gta.fps=24", "gta.render=0.75"])
    const stage = async () => json(await call(["show", "alpha", "--json"])).data.view.stage
    expect(await stage()).toBe("Runnable")
    expect((await call(["set", "alpha", "goalProof.fps=README", "--json"])).code).toBe(2)
    const link = "https://example.com/run?a=b"
    await call(["set", "alpha", `goalProof.fps=${link}`, `goalProof.render=${link}`])
    expect(await stage()).toBe("Playable")
    expect((await call(["check", "--json"])).code).toBe(0)
  })

  it("returns field rules as JSON", async () => {
    const result = await call(["schema", "patch", "--json"])
    expect(result.code).toBe(0)
    expect(json(result).data.patch["gta.story"]).toEqual([0, 0.1, 0.25, 0.4, 0.6, 0.85, 1])
  })

  it("fails a check on a bad override and exits 3", async () => {
    await writeFile(
      overridesFile,
      JSON.stringify({ patches: [{ id: "nope", from: {}, to: { "gta.render": 0.3 } }], added: [] })
    )
    const result = await call(["check", "--json"])
    expect(result.code).toBe(3)
    expect(json(result).error.code).toBe("check_failed")
  })
})

describe("pw set", () => {
  it("writes a patch with upstream's value in from", async () => {
    const result = await call(["set", "alpha", "gta.loads=1", "--json"])
    expect(result.code).toBe(0)
    expect(json(result).meta.saved).toBe(true)
    const overrides = await readOverrides()
    expect(overrides.patches[0].from["gta.loads"]).toBe(0)
    expect(overrides.patches[0].to["gta.loads"]).toBe(1)
    expect(overrides.patches[0].to.assessedAt).toBe(new Date().toISOString().slice(0, 10))
    expect(overrides.patches[0].to.assessedBy).toBe("claude")
    expect(overrides.patches[0].changes[0].kind).toBe("new")
  })

  it("writes nothing on a dry run", async () => {
    const result = await call(["set", "alpha", "gta.world=1", "--dry-run", "--json"])
    expect(result.code).toBe(0)
    expect(json(result).meta.dryRun).toBe(true)
    expect((await readOverrides()).patches).toHaveLength(0)
  })

  it("refuses a bad step value", async () => {
    const result = await call(["set", "alpha", "gta.story=0.2", "--json"])
    expect(result.code).toBe(2)
    expect(json(result).error.code).toBe("invalid")
    expect((await readOverrides()).patches).toHaveLength(0)
  })

  it("refuses a lapsed patch, then rebases it", async () => {
    await call(["set", "alpha", "gta.world=1"])
    const trackerFile = path.join(data, "tracker.json")
    const tracker = JSON.parse(await readFile(trackerFile, "utf8"))
    tracker.efforts[0].gta.world = 1
    await writeFile(trackerFile, JSON.stringify(tracker, null, 2))

    const blocked = await call(["set", "alpha", "gta.world=0.5", "--json"])
    expect(blocked.code).toBe(3)
    expect(json(blocked).error.code).toBe("conflict")

    const fixed = await call(["set", "alpha", "gta.world=0.5", "--rebase", "--json"])
    expect(fixed.code).toBe(0)
    const overrides = await readOverrides()
    expect(overrides.patches[0].from["gta.world"]).toBe(1)
    expect(overrides.patches[0].to["gta.world"]).toBe(0.5)
  })

  it("is blocked by a lock", async () => {
    await mkdir(path.join(data, ".pw"), { recursive: true })
    await writeFile(path.join(data, ".pw", "lock"), JSON.stringify({ pid: process.pid }))
    const result = await call(["set", "alpha", "gta.world=1", "--json"])
    expect(result.code).toBe(4)
    expect(json(result).error.code).toBe("locked")
  })

  it("rebases every lapsed field after a dry run", async () => {
    await call(["set", "alpha", "gta.loads=1"])
    const trackerFile = path.join(data, "tracker.json")
    const tracker = JSON.parse(await readFile(trackerFile, "utf8"))
    tracker.efforts[0].gta.loads = 1
    await writeFile(trackerFile, JSON.stringify(tracker, null, 2))
    expect((await call(["check", "--json"])).code).toBe(3)

    const before = await readFile(overridesFile, "utf8")
    const dry = await call(["rebase", "alpha", "--dry-run", "--json"])
    expect(dry.code).toBe(0)
    expect(await readFile(overridesFile, "utf8")).toBe(before)

    expect((await call(["rebase", "alpha", "--json"])).code).toBe(0)
    expect((await readOverrides()).patches[0].from["gta.loads"]).toBe(1)
    expect((await call(["check", "--json"])).code).toBe(0)
  })
})

describe("pw find", () => {
  it("adds a finding and its source note", async () => {
    const result = await call([
      "find",
      "alpha",
      "--text",
      "The first frame appears.",
      "--url",
      "https://example.com/post",
      "--source",
      "From the post.",
      "--json",
    ])
    expect(result.code).toBe(0)
    const patch = (await readOverrides()).patches[0]
    expect(patch.to.findings).toEqual([
      { text: "The first frame appears.", url: "https://example.com/post" },
    ])
    expect(patch.to.findingsSource).toBe("From the post.")
  })

  it("requires an https URL", async () => {
    const result = await call(["find", "alpha", "--text", "A frame."])
    expect(result.code).toBe(2)
    expect(result.stderr).toContain("--url")
  })
})

describe("pw news", () => {
  const paragraphs = [words(45, "a"), words(45, "b"), words(45, "c")]
  const args = [
    "news",
    "add",
    "--title",
    "A new thing",
    "--dek",
    "One sentence.",
    "--category",
    "Port",
    ...paragraphs.flatMap((p) => ["--body", p]),
    "--source",
    "GitHub|repo|https://github.com/new/repo",
  ]

  it("adds an article that passes check", async () => {
    const result = await call([...args, "--json"])
    expect(result.code).toBe(0)
    expect((await readOverrides()).news[0].title).toBe("A new thing")
    const checked = await call(["check", "--json"])
    expect(checked.code).toBe(0)
  })

  it("needs a source", async () => {
    const without = args.slice(0, args.indexOf("--source"))
    const result = await call([...without, "--json"])
    expect(result.code).toBe(2)
    expect((await readOverrides()).news).toBeUndefined()
  })

  it("shadows an upstream article on edit without hiding it", async () => {
    const result = await call([
      "news",
      "set",
      "2026-01-01-old",
      "title=An edited article",
      "--json",
    ])
    expect(result.code).toBe(0)
    const overrides = await readOverrides()
    expect(overrides.news[0].title).toBe("An edited article")
    expect(overrides.news[0].by).toBe("PortWatch")
    expect(overrides.removedNews).toEqual([])
    const shown = await call(["news", "list", "--json"])
    const found = json(shown).data.articles.find((n: { id: string }) => n.id === "2026-01-01-old")
    expect(found.title).toBe("An edited article")
    expect((await call(["check", "--json"])).code).toBe(0)
  })

  it("removes an upstream article by id, and the removal survives", async () => {
    const result = await call(["news", "rm", "2026-01-01-old", "--json"])
    expect(result.code).toBe(0)
    expect((await readOverrides()).removedNews).toEqual(["2026-01-01-old"])
    const shown = await call(["news", "list", "--json"])
    expect(json(shown).data.articles.some((n: { id: string }) => n.id === "2026-01-01-old")).toBe(
      false
    )
  })
})

describe("pw pick and candidates", () => {
  it("sets and clears a pick", async () => {
    expect((await call(["pick", "set", "alpha", "--reason", "Best picture."])).code).toBe(0)
    expect((await readOverrides()).pick.id).toBe("alpha")
    expect((await call(["pick", "clear"])).code).toBe(0)
    expect((await readOverrides()).pick).toBeNull()
  })

  it("ignores a candidate and takes it out of the inbox", async () => {
    const result = await call(["candidate", "ignore", "new/repo", "--reason", "A copy."])
    expect(result.code).toBe(0)
    const overrides = await readOverrides()
    expect(overrides.ignored[0].repo).toBe("new/repo")
    expect(overrides.decided).toEqual(["new/repo"])
    const list = await call(["candidate", "list", "--json"])
    expect(json(list).data.candidates.some((c: { repo: string }) => c.repo === "new/repo")).toBe(
      false
    )
  })
})

describe("global flags", () => {
  it.each([
    ["before the command", () => ["--data", data, "--root", root, "status", "--json"]],
    ["after the command", () => ["status", "--data", data, "--root", root, "--json"]],
    ["with an equals sign", () => ["status", `--data=${data}`, `--root=${root}`, "--json"]],
  ])("takes --data and --root %s", async (_, args) => {
    const result = await new Promise<Ran>((resolve) => {
      execFile(process.execPath, [CLI, ...args()], (err, stdout, stderr) =>
        resolve({ code: Number(err?.code ?? 0), stdout, stderr })
      )
    })
    expect(result.code).toBe(0)
    expect(json(result).meta.dataDir).toBe(data)
  })
})
