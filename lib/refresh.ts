import { createHmac, timingSafeEqual } from "node:crypto"
import { z } from "zod"

/** GitHub's X-Hub-Signature-256: an HMAC of the body as it was sent. */
export function isSigned(secret: string, body: string, header: string | null) {
  const theirs = Buffer.from(header ?? "")
  const ours = Buffer.from(`sha256=${createHmac("sha256", secret).update(body).digest("hex")}`)
  return theirs.length === ours.length && timingSafeEqual(theirs, ours)
}

const files = z.array(z.string()).default([])
const push = z.object({
  ref: z.string(),
  after: z.string(),
  forced: z.boolean().default(false),
  commits: z
    .array(z.object({ id: z.string(), added: files, modified: files, removed: files }))
    .default([]),
})

// GitHub lists at most this many. With more, the one that matters may be missing.
const LISTED = 2048

/** The last commit of a push to this branch that touched data/. Null if none did. */
export function dataCommit(payload: unknown, branch: string): string | null {
  const parsed = push.safeParse(payload)
  if (!parsed.success || parsed.data.ref !== `refs/heads/${branch}`) return null
  const { after, forced, commits } = parsed.data
  const touched = commits.findLast((c) =>
    [...c.added, ...c.modified, ...c.removed].some((f) => f.startsWith("data/"))
  )
  if (touched) return touched.id
  return forced || commits.length >= LISTED ? after : null
}
