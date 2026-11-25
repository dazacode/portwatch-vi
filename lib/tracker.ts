import localActivity from "@/data/activity.json"
import localChannels from "@/data/channels.json"
import localEvidence from "@/data/evidence.json"
import localMilestones from "@/data/milestones.json"
import localNews from "@/data/news.json"
import localOverrides from "@/data/overrides.json"
import localTracker from "@/data/tracker.json"
import { plainTitle } from "@/lib/format"
import { hideInActivity, hideInNews, hideInTracker } from "@/lib/hide"
import { LADDER } from "@/lib/ladder"
import type { Channel } from "@/lib/live/types"
import type { Milestone } from "@/lib/milestones"
import { applyOverrides } from "@/lib/overrides.mjs"
import { rate } from "@/lib/rating.mjs"
import { isPrivateBuild, overall, scoreEffort } from "@/lib/scoring.mjs"
import { getUpstream } from "@/lib/upstream"
import { verify } from "@/lib/verification.mjs"

export type Effort = {
  id: string
  name: string
  repo: string | null
  tier: "tracked" | "watchlist"
  summary: string
  blockers: string[]
  verification: string
  /** Concrete observations from the newest footage, each with its source. */
  findings?: { text: string; url?: string }[]
  /** Where the findings above come from. */
  findingsSource?: string
  /** The code is private for now, but the project says it will publish it once the build is out. */
  publicLater?: boolean
  /** What upstream scores it, before our findings. Null when upstream doesn't list it. */
  sourceScore?: number | null
  nuked?: { at: string; note: string }
  gta: Record<"loads" | "boots" | "menu" | "world" | "playable" | "fps", number>
  stats: {
    stars?: number
    commits7d?: number | null
    missing?: boolean
    missingStatus?: number
    createdAt?: string
    pushedAt?: string
    archived?: boolean
  }
}

export type Evidence = {
  effortId: string
  kind: "challenge" | "tester" | "contributor" | "rule"
  outcome: "reached" | "failed"
  stage: string
  quote: string
  commit: string | null
  gpu: string | null
  url: string
  at: string
  by: string
}

export type StageCheck = {
  stage: string
  confidence: number
  people: number
  failures: number
  verified: boolean
}

export type FeedItem = {
  id: string
  title: string
  url: string
  outlet: string
  date: string
  via: string
  category: string
  score?: number
}

export type NewsFile = { updated: string | null; items: FeedItem[] }

export type ActivityCommit = {
  projectId: string | null
  repo: string
  sha: string
  message: string
  author: string
  at: string
  url: string
}

export type PullRequest = {
  projectId: string | null
  repo: string
  number: number
  title: string
  state: "open" | "merged" | "closed"
  draft: boolean
  author: string
  at: string
  url: string
}

export type PublicRepo = {
  repo: string
  description: string
  stars: number
  pushedAt: string
  language: string | null
  url: string
}

export type ProjectActivity = {
  openPrs: number
  commits: ActivityCommit[]
  pulls: PullRequest[]
}

export type Activity = {
  updated: string | null
  projects: Record<string, ProjectActivity>
  feed: (PullRequest | ActivityCommit)[]
  discovered: PublicRepo[]
}

export type NewsArticle = {
  id: string
  date: string
  category: string
  title: string
  dek: string
  body: string[]
  sources: { outlet: string; title: string; url: string }[]
  image: string | null
  by: string
}

/** The Xbox build's executable: a countdown until it is out, a count up from then on. */
export type Exe = {
  status: string
  expected?: string
  expectedAt?: string
  releasedAt?: string
  source?: string
}

export type Tracker = {
  updated: string
  exe: Exe
  efforts: Effort[]
  news: NewsArticle[]
  changes: { date: string; kind: string; text: string }[]
  headlines: { title: string; outlet: string; link: string; date: string }[]
  dmca: { url: string; date: string; repoCount: number; gta6: boolean; tracked: string[] }[]
  flagged: { id: string; pattern: string; reason: string }[]
  scout: { lastRun: string }
  /** The project we place first ourselves, where private builds are ranked too. Always marked. */
  pick?: { id: string; at: string; reason: string } | null
}

// On Vercel the data is read from the repo, so a scout commit reaches the site without a deploy.
const {
  VERCEL_GIT_REPO_OWNER: owner,
  VERCEL_GIT_REPO_SLUG: slug,
  VERCEL_GIT_COMMIT_REF: ref,
} = process.env
const DATA_URL =
  process.env.DATA_URL ??
  (owner && slug && ref ? `https://raw.githubusercontent.com/${owner}/${slug}/${ref}/data` : null)

async function load<T>(file: string, fallback: T): Promise<T> {
  if (!DATA_URL) return fallback
  try {
    const res = await fetch(`${DATA_URL}/${file}`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(String(res.status))
    return (await res.json()) as T
  } catch (err) {
    console.error(`[data] ${file}: using the bundled copy,`, err)
    return fallback
  }
}

type Overrides = {
  patches: object[]
  added: object[]
  news?: object[]
  ignored?: object[]
  decided?: string[]
  removedNews?: string[]
  pick?: object
}

/** Unfiltered, with our findings on top. For dates and counts, never for text that is shown. */
export async function getRecords(): Promise<Tracker> {
  const [live, overrides] = await Promise.all([
    getUpstream(),
    load<Overrides>("overrides.json", localOverrides),
  ])
  const tracker = live ?? (await load("tracker.json", localTracker as unknown as Tracker))
  return applyOverrides(tracker, overrides).tracker as Tracker
}
export const getTracker = async () => hideInTracker(await getRecords())
export const getMilestones = () => load("milestones.json", localMilestones as Milestone[])
export const getEvidence = async () =>
  (await load("evidence.json", localEvidence as unknown as { items: Evidence[] })).items
export const getChannels = () => load("channels.json", localChannels as Channel[])
export const getNews = async () =>
  hideInNews(await load("news.json", localNews as unknown as NewsFile))
export const getActivity = async () =>
  hideInActivity(await load("activity.json", localActivity as unknown as Activity))

export { LADDER }

/** One line of the sum behind our score. A null note was never measured. */
export type ScorePart = {
  key: string
  label: string
  claimed: number
  counted: number
  max: number
  note: string | null
}

export type Standing = {
  id: string
  name: string
  url: string | null
  isPrivate: boolean
  nuked: string | null
  missing: boolean
  tier: Effort["tier"]
  /** Our score: the claim, discounted by how little of it others have seen. The ranking is by this. */
  rating: number
  parts: ScorePart[]
  /** What upstream scores it. Null when upstream doesn't list it. */
  sourceScore: number | null
  /** What it claims. */
  score: number
  stage: string
  /** One value per LADDER step: 0, 0.5 or 1. */
  steps: number[]
  fps: number
  stars: number | null
  commits7d: number | null
  /** Points other people's evidence supports. Never more than the claimed score. */
  verified: number
  verifiedStage: string | null
  claimedStage: string
  checks: StageCheck[]
  /** Concrete observations from the newest footage, each with its source. */
  findings: { text: string; url?: string }[]
  findingsSource: string | null
  summary: string
}

const evidenceSum = (s: Standing) => s.checks.reduce((sum, c) => sum + c.confidence, 0)

/** By our score. Equal scores go by evidence, then the claim, then stars. */
export function getStandings(tracker: Tracker, evidence: Evidence[]): Standing[] {
  return tracker.efforts
    .map((e): Standing => {
      const s = scoreEffort(e)
      const v = verify(
        evidence.filter((x) => x.effortId === e.id),
        s.score
      )
      const ours = rate(e, v.stages)
      return {
        id: e.id,
        name: e.name,
        url: e.repo && !e.nuked && !e.stats.missing ? `https://github.com/${e.repo}` : null,
        isPrivate: isPrivateBuild(e),
        nuked: e.nuked?.at ?? null,
        missing: e.stats.missing ?? false,
        tier: e.tier,
        rating: ours.score,
        parts: ours.parts,
        sourceScore: e.sourceScore ?? null,
        score: s.score,
        stage: s.reachedLabel,
        steps: LADDER.map((m) => e.gta[m.key as keyof Effort["gta"]] ?? 0),
        fps: e.gta.fps ?? 0,
        stars: e.stats.stars ?? null,
        commits7d: e.stats.commits7d ?? null,
        verified: v.score,
        verifiedStage: LADDER.find((m) => m.key === v.reached)?.label ?? null,
        claimedStage: s.reached,
        checks: v.stages,
        findings: e.findings ?? [],
        findingsSource: e.findingsSource ?? null,
        summary: e.summary,
      }
    })
    .sort(
      (a, b) =>
        Number(Boolean(a.nuked)) - Number(Boolean(b.nuked)) ||
        b.rating - a.rating ||
        evidenceSum(b) - evidenceSum(a) ||
        b.score - a.score ||
        (b.stars ?? 0) - (a.stars ?? 0)
    )
}

export function getAnswer(tracker: Tracker) {
  const { furthest, leader } = overall(tracker.efforts)
  return {
    done: furthest.key === "complete",
    furthest: furthest.label,
    leader: leader ? { name: leader.effort.name as string, score: leader.score as number } : null,
  }
}

/** What the opening clock counts from (released) or to. Null without a usable date. */
export function getDrop({ exe }: Pick<Tracker, "exe">) {
  const released = exe.status === "released" && Boolean(exe.releasedAt)
  const at = (released ? exe.releasedAt : exe.expectedAt) ?? exe.expected
  if (!at || !Number.isFinite(Date.parse(at))) return null
  const source = exe.source?.startsWith("https://") ? exe.source : null
  return { at, released, source }
}

export type Drop = NonNullable<ReturnType<typeof getDrop>>

const CHANGE_KINDS = new Set(["up", "down", "claim", "removed"])

/** Newest first. READMEs are quoted in some entries, so their emoji and list marks are dropped. */
export const getChanges = (tracker: Tracker, count: number) =>
  tracker.changes
    .filter((c) => CHANGE_KINDS.has(c.kind))
    .slice(-count)
    .reverse()
    .map((c) => ({
      ...c,
      text: plainTitle(c.text).replace(/“[-*]\s+/g, "“"),
    }))
