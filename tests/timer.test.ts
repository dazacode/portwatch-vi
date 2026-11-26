import { afterEach, describe, expect, it, vi } from "vitest"
import { due, run } from "@/timer/worker.mjs"

const at = (time: string) => Date.parse(`2026-11-25T${time}Z`)
const names = (time: string) => due(at(time)).map((j) => j.workflow)

describe("due", () => {
  it.each([
    ["00:00:00", ["harvest.yml"]],
    ["00:05:00", ["intel.yml"]],
    ["00:15:00", []],
    ["00:10:02", ["upstream-sync.yml"]],
    ["00:20:00", ["intel.yml"]],
    ["00:25:00", ["scout.yml"]],
    ["00:40:00", ["upstream-sync.yml", "editor.yml"]],
    ["01:20:00", ["intel.yml"]],
    ["03:25:00", ["scout.yml"]],
    ["13:30:00", ["harvest.yml"]],
  ])("at %s", (time, expected) => expect(names(time)).toEqual(expected))

  it("runs each job as often as it should in a day", () => {
    const count: Record<string, number> = {}
    for (let i = 0; i < 288; i++)
      for (const j of due(at("00:00:00") + i * 300_000))
        count[j.workflow] = (count[j.workflow] ?? 0) + 1
    expect(count).toEqual({
      "harvest.yml": 48,
      "intel.yml": 96,
      "upstream-sync.yml": 48,
      "scout.yml": 8,
      "editor.yml": 24,
    })
  })

  it("keeps the jobs that share a queue apart", () => {
    for (let i = 0; i < 288; i++)
      expect(due(at("00:00:00") + i * 300_000).length).toBeLessThanOrEqual(2)
  })
})

describe("run", () => {
  afterEach(() => vi.unstubAllGlobals())
  const env = { GH_TOKEN: "t", REPO: "o/r" }

  function stub(lastRun: string | null, dispatch = 204) {
    const calls: string[] = []
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (init?.method !== "POST")
        return Response.json({ workflow_runs: lastRun ? [{ created_at: lastRun }] : [] })
      calls.push(`${url.split("/workflows/")[1]} ${init.body}`)
      return new Response(null, { status: dispatch })
    })
    return calls
  }

  it("starts what is due, on main", async () => {
    const calls = stub(null)
    await run(env, at("00:10:00"))
    expect(calls).toEqual(['upstream-sync.yml/dispatches {"ref":"main"}'])
  })

  it("leaves what has just run", async () => {
    const calls = stub("2026-11-25T00:08:00Z")
    await run(env, at("00:10:00"))
    expect(calls).toEqual([])
  })

  it("fails loudly", async () => {
    stub(null, 403)
    await expect(run(env, at("00:00:00"))).rejects.toThrow("harvest.yml: GitHub answered 403")
    await expect(run({ REPO: "o/r" }, at("00:00:00"))).rejects.toThrow("GH_TOKEN")
  })
})
