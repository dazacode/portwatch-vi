import { afterEach, describe, expect, it, vi } from "vitest"
import { GET } from "@/app/api/challenge/[project]/route"

const call = (project: string) =>
  GET(new Request(`http://localhost/api/challenge/${project}`), {
    params: Promise.resolve({ project }),
  })

const original = process.env.CHALLENGE_SECRET

afterEach(() => {
  if (original === undefined) delete process.env.CHALLENGE_SECRET
  else process.env.CHALLENGE_SECRET = original
})

describe("GET /api/challenge/[project]", () => {
  it("issues a code and three actions for a project that reaches the menu", async () => {
    process.env.CHALLENGE_SECRET = "test-secret"
    const res = await call("five-star-recomp")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.stage).toBe("menu")
    expect(body.code).toMatch(/^[A-Z]+-\d{4}$/)
    expect(body.actions).toHaveLength(3)
    expect(Date.parse(body.endsAt)).toBeGreaterThan(Date.parse(body.startsAt))
  })

  it("is stable inside a ten-minute window", async () => {
    process.env.CHALLENGE_SECRET = "test-secret"
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-11-24T12:03:00Z"))
    const [a, b] = await Promise.all([call("five-star-recomp"), call("five-star-recomp")])
    expect((await a.json()).code).toBe((await b.json()).code)
    vi.useRealTimers()
  })

  it("404s for an unknown project", async () => {
    process.env.CHALLENGE_SECRET = "test-secret"
    expect((await call("not-a-project")).status).toBe(404)
  })

  it("503s without a secret outside development", async () => {
    delete process.env.CHALLENGE_SECRET
    const res = await call("five-star-recomp")
    expect(res.status).toBe(503)
    expect((await res.json()).error).toContain("CHALLENGE_SECRET")
  })
})
