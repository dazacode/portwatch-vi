import { newestCommit } from "@/lib/atom"

/** Everything read from data/ in the repo. /api/refresh drops it when something there is pushed. */
export const DATA_TAG = "data"

// On Vercel the data is read from the repo, so a commit there reaches the site without a deploy.
const {
  DATA_URL,
  VERCEL_GIT_REPO_OWNER: owner,
  VERCEL_GIT_REPO_SLUG: slug,
  VERCEL_GIT_COMMIT_REF: ref,
} = process.env
export const REPO = owner && slug && ref ? { name: `${owner}/${slug}`, ref } : null

/** The commits that touched data/, newest first. */
export const dataFeed = (repo: { name: string; ref: string }) =>
  `https://github.com/${repo.name}/commits/${repo.ref}/data.atom`

async function get(url: string, revalidate: number) {
  const res = await fetch(url, {
    headers: { "User-Agent": "viportlive" },
    next: { revalidate, tags: [DATA_TAG] },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`${url} answered ${res.status}`)
  return res
}

/**
 * Where the newest data is. A file at a commit never changes, so GitHub's five-minute cache of a branch
 * doesn't get in between. If the feed can't be read, the branch will do.
 */
async function base(): Promise<{ url: string; fixed: boolean } | null> {
  if (DATA_URL) return { url: DATA_URL, fixed: false }
  if (!REPO) return null
  const raw = (at: string) => `https://raw.githubusercontent.com/${REPO.name}/${at}/data`
  try {
    const sha = newestCommit(await (await get(dataFeed(REPO), 60)).text())
    if (sha) return { url: raw(sha), fixed: true }
  } catch (err) {
    console.error("[data] reading the branch:", err instanceof Error ? err.message : err)
  }
  return { url: raw(REPO.ref), fixed: false }
}

/** A file of data/ as it was last pushed, or the copy this build came with. */
export async function loadData<T>(file: string, fallback: T): Promise<T> {
  const from = await base()
  if (!from) return fallback
  try {
    return (await (await get(`${from.url}/${file}`, from.fixed ? 86400 : 300)).json()) as T
  } catch (err) {
    console.error(`[data] ${file}: using the bundled copy,`, err)
    return fallback
  }
}
