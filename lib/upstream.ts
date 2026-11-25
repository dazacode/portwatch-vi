import { newestCommit } from "@/lib/atom"
import { isTracker } from "@/lib/overrides.mjs"
import { SOURCE } from "@/lib/site"
import type { Tracker } from "@/lib/tracker"

const FILE = "data/tracker.json"
/** Seconds. How often it is asked whether there is something newer. */
const CHECK = 60

async function get(url: string, revalidate: number) {
  const res = await fetch(url, {
    headers: { "User-Agent": "viportlive" },
    next: { revalidate },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`${url} answered ${res.status}`)
  return res
}

/**
 * Upstream's tracker as it was last published. Their commit feed says which commit is the newest, and a
 * file at a commit never changes, so there is no five-minute cache of a branch in between.
 * Null when it can't be read, or isn't what the pages expect: then the synced copy is used.
 */
export async function getUpstream(): Promise<Tracker | null> {
  // Tests and offline work use the copy in the repo.
  if (process.env.NODE_ENV === "test" || process.env.UPSTREAM_DATA === "off") return null
  try {
    const feed = await get(`https://github.com/${SOURCE.repo}/commits/main/${FILE}.atom`, CHECK)
    const sha = newestCommit(await feed.text())
    if (!sha) throw new Error("no commit in the feed")
    const raw = `https://raw.githubusercontent.com/${SOURCE.repo}/${sha}/${FILE}`
    const tracker: unknown = await (await get(raw, 86400)).json()
    if (!isTracker(tracker)) throw new Error(`${sha} is not a tracker the site can read`)
    return tracker as Tracker
  } catch (err) {
    console.error("[upstream] using the synced copy:", err instanceof Error ? err.message : err)
    return null
  }
}
