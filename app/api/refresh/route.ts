import { revalidateTag } from "next/cache"
import { newestCommit } from "@/lib/atom"
import { DATA_TAG, dataFeed, REPO } from "@/lib/data"
import { dataCommit, isSigned } from "@/lib/refresh"

const MAX_BODY = 2_000_000
// GitHub waits ten seconds for an answer.
const PATIENCE = 6000
const PAUSE = 750

const answer = (body: object, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } })

/** GitHub's commit feed can be a moment behind the push. Read too early, the old data would be kept. */
async function appears(sha: string, repo: NonNullable<typeof REPO>) {
  const until = Date.now() + PATIENCE
  while (Date.now() < until) {
    try {
      const res = await fetch(dataFeed(repo), {
        headers: { "User-Agent": "viportlive" },
        cache: "no-store",
        signal: AbortSignal.timeout(2000),
      })
      if (res.ok && newestCommit(await res.text()) === sha) return true
    } catch {}
    await new Promise((done) => setTimeout(done, PAUSE))
  }
  return false
}

/** Called by GitHub's push webhook. Only a push that touches data/ does anything. */
export async function POST(request: Request) {
  const secret = process.env.REFRESH_SECRET
  if (!secret || !REPO) return answer({ error: "Not set up" }, 503)
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY)
    return answer({ error: "Too large" }, 413)
  const body = await request.text()
  if (!isSigned(secret, body, request.headers.get("x-hub-signature-256")))
    return answer({ error: "Bad signature" }, 401)

  const event = request.headers.get("x-github-event")
  if (event !== "push") return answer({ refreshed: false, event })
  let payload: unknown
  try {
    payload = JSON.parse(body)
  } catch {
    return answer({ error: "Not JSON" }, 400)
  }
  const sha = dataCommit(payload, REPO.ref)
  if (!sha) return answer({ refreshed: false, event })
  const seen = await appears(sha, REPO)
  // Gone at once, not served once more: an article taken down should be down.
  revalidateTag(DATA_TAG, { expire: 0 })
  return answer({ refreshed: true, commit: sha, seen })
}
