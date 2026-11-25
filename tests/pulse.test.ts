import { afterEach, describe, expect, it, vi } from "vitest"
import { lastCommitsFast } from "@/scripts/lib/pulse.mjs"

const effort = (over = {}) => ({ id: "p", repo: "o/r", ...over })

const feed = (title: string, sha: string, at = "2026-11-24T12:00:00Z") => `<?xml version="1.0"?>
<feed><entry>
  <id>tag:github.com,2008:Grit::Commit/${sha}</id>
  <updated>${at}</updated>
  <link rel="alternate" type="text/html" href="https://github.com/o/r/commit/${sha}"/>
  <title>${title}</title>
</entry></feed>`

const reply = (body: string, status = 200) => new Response(body, { status })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("lastCommitsFast", () => {
  it("reads the latest entry and cleans the message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => reply(feed("Shaders &amp; tiles: fix the wall", "a".repeat(40))))
    )
    const out = (await lastCommitsFast([effort()])) as Record<
      string,
      { sha: string; message: string; url: string }
    >
    expect(out.p.sha).toBe("aaaaaaa")
    expect(out.p.message).toBe("Shaders & tiles: fix the wall")
    expect(out.p.url).toContain("/commit/")
  })

  it("takes the pull request title from a merge commit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => reply(feed("Merge pull request #12 from x/y\nReal title", "b".repeat(40))))
    )
    const out = (await lastCommitsFast([effort()])) as Record<string, { message: string }>
    expect(out.p.message).toBe("Real title")
  })

  it("follows a named branch and skips gone and nuked projects", async () => {
    const spy = vi.fn(async () => reply(feed("hi", "c".repeat(40))))
    vi.stubGlobal("fetch", spy)
    await lastCommitsFast([
      effort({ id: "a", branch: "dev" }),
      effort({ id: "b", nuked: { at: "2026-11-24" } }),
      effort({ id: "c", stats: { missing: true } }),
    ])
    expect(spy).toHaveBeenCalledTimes(1)
    const calls = spy.mock.calls as unknown as [string][]
    expect(calls[0][0]).toBe("https://github.com/o/r/commits/dev.atom")
  })

  it("leaves out a repository that does not answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => reply("nope", 404))
    )
    expect(await lastCommitsFast([effort()])).toEqual({})
  })
})
