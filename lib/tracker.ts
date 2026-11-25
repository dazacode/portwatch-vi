import localChannels from "@/data/channels.json"
import localEvidence from "@/data/evidence.json"
import localMilestones from "@/data/milestones.json"
import localTracker from "@/data/tracker.json"
import { plainTitle } from "@/lib/format"
import type { Channel } from "@/lib/live/types"
import type { Milestone } from "@/lib/milestones"
import { isPrivateBuild, MILESTONES, overall, scoreEffort } from "@/lib/scoring.mjs"
import { verify } from "@/lib/verification.mjs"

export type Effort = {
  id: string
  name: string
  repo: string | null
  tier: "tracked" | "watchlist"
  summary: string
  blockers: string[]
  verification: string
  nuked?: { at: string; note: string }
  gta: Record<"loads" | "boots" | "menu" | "world" | "playable" | "fps", number>
  stats: { stars?: number; commits7d?: number | null; missing?: boolean }
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

export type Tracker = {
  updated: string
  efforts: Effort[]
  changes: { date: string; kind: string; text: string }[]
  headlines: { title: string; outlet: string; link: string; date: string }[]
  dmca: { url: string; date: string; repoCount: number; gta6: boolean; tracked: string[] }[]
  flagged: { id: string; pattern: string; reason: string }[]
  scout: { lastRun: string }
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

export const getTracker = () => load("tracker.json", localTracker as unknown as Tracker)
export const getMilestones = () => load("milestones.json", localMilestones as Milestone[])
export const getEvidence = async () =>
  (await load("evidence.json", localEvidence as unknown as { items: Evidence[] })).items
export const getChannels = () => load("channels.json", localChannels as Channel[])

export const LADDER = MILESTONES.filter((m) => m.key !== "groundwork" && m.key !== "complete")

export type Standing = {
  id: string
  name: string
  url: string | null
  isPrivate: boolean
  nuked: string | null
  missing: boolean
  tier: Effort["tier"]
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
  summary: string
}

const evidenceSum = (s: Standing) => s.checks.reduce((sum, c) => sum + c.confidence, 0)

/** Verified first, then the evidence gathered so far. A claim only breaks what is left. */
export function getStandings(tracker: Tracker, evidence: Evidence[]): Standing[] {
  return tracker.efforts
    .map((e): Standing => {
      const s = scoreEffort(e)
      const v = verify(
        evidence.filter((x) => x.effortId === e.id),
        s.score
      )
      return {
        id: e.id,
        name: e.name,
        url: e.repo && !e.nuked && !e.stats.missing ? `https://github.com/${e.repo}` : null,
        isPrivate: isPrivateBuild(e),
        nuked: e.nuked?.at ?? null,
        missing: e.stats.missing ?? false,
        tier: e.tier,
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
        summary: e.summary,
      }
    })
    .sort(
      (a, b) =>
        Number(Boolean(a.nuked)) - Number(Boolean(b.nuked)) ||
        b.verified - a.verified ||
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
