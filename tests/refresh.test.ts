import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import { POST } from "@/app/api/refresh/route"
import { dataCommit, isSigned } from "@/lib/refresh"

const sign = (secret: string, body: string) =>
  `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`

describe("isSigned", () => {
  it("takes GitHub's own example", () =>
    expect(
      isSigned(
        "It's a Secret to Everybody",
        "Hello, World!",
        "sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17"
      )
    ).toBe(true))

  it.each([
    ["no signature", null],
    ["an empty one", ""],
    ["another secret", sign("other", "body")],
    ["another body", sign("secret", "body2")],
    ["no prefix", sign("secret", "body").slice(7)],
  ])("refuses %s", (_, header) => expect(isSigned("secret", "body", header)).toBe(false))
})

describe("dataCommit", () => {
  const commit = (id: string, ...modified: string[]) => ({ id, added: [], removed: [], modified })
  const push = (commits: object[], over = {}) => ({
    ref: "refs/heads/main",
    after: "z",
    commits,
    ...over,
  })

  it("is the last one that touched data/", () =>
    expect(
      dataCommit(
        push([
          commit("a", "data/news.json"),
          commit("b", "data/x.json"),
          commit("c", "app/page.tsx"),
        ]),
        "main"
      )
    ).toBe("b"))

  it.each([
    ["only code", push([commit("a", "lib/data/x.ts", "database.json")])],
    ["another branch", push([commit("a", "data/x.json")], { ref: "refs/heads/pulse" })],
    ["a deleted branch", push([])],
    ["something else", "nonsense"],
  ])("is null for %s", (_, payload) => expect(dataCommit(payload, "main")).toBeNull())

  it("takes the end of a forced push", () =>
    expect(dataCommit(push([], { forced: true }), "main")).toBe("z"))
})

describe("POST /api/refresh", () => {
  it("does nothing until it is set up", async () => {
    const res = await POST(
      new Request("https://x.test/api/refresh", { method: "POST", body: "{}" })
    )
    expect(res.status).toBe(503)
  })
})
