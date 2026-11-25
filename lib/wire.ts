// Breaking news without a model: rules over the public commit and pull-request streams. Every item
// is derived from something linkable, so nothing has to be written or reviewed by hand.
import type { PullRequest } from "@/lib/tracker"

export type LiveCommit = {
  projectId: string
  name: string
  sha: string
  message: string
  at: string
  url: string
}

export type WireKind = "burst" | "signal" | "return" | "pull" | "merge"

export type WireItem = {
  /** Stable while the event is current, so the show does not cut in twice for the same thing. */
  id: string
  kind: WireKind
  /** 3 cuts in, 2 can be a slide, 1 is ticker material. */
  severity: 1 | 2 | 3
  at: string
  projectId: string | null
  title: string
  detail: string
  url: string
}

const MINUTE = 60_000
const BURST_MS = 20 * MINUTE
const SIGNAL_MS = 90 * MINUTE
const RETURN_MS = 12 * 36e5
const PULL_MS = 45 * MINUTE
const BUCKET = 15 * MINUTE

// Words that suggest something happened, not just that files changed. `shader` is too common.
const SIGNALS: [RegExp, string][] = [
  [/\bplayable\b|\bgameplay\b/i, "playable"],
  [/\b(main|title|pause)\s+menu\b|\bmenus?\b/i, "the menu"],
  [/\b(in[- ]game|game world|open world|prologue|first mission)\b/i, "the game world"],
  [/\b(boots?|booted|first frame|intro|splash)\b/i, "boot"],
  [/\b(\d{2,3})\s?fps\b|\bframe ?rate\b/i, "frame rate"],
  [/\b(save|load(ing)?)\s+game\b|\bsavegame\b/i, "saving"],
  [/\bcrash(es|ed|ing)?\b|\bhang(s|ing)?\b/i, "crashes"],
  [/\b(controller|gamepad|pad)\s+(input|support|works?)\b/i, "controller input"],
]

const bucket = (at: number) => Math.floor(at / BUCKET)
const minutes = (ms: number) => Math.max(1, Math.round(ms / MINUTE))

export function wireItems(
  commits: LiveCommit[],
  pulls: PullRequest[],
  now = Date.now()
): WireItem[] {
  const out: WireItem[] = []
  const recent = commits.filter((c) => now - Date.parse(c.at) < 7 * 24 * 36e5)
  const byProject = new Map<string, LiveCommit[]>()
  for (const c of recent) {
    const list = byProject.get(c.projectId) ?? []
    list.push(c)
    byProject.set(c.projectId, list)
  }

  for (const [projectId, list] of byProject) {
    list.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    const latest = list[0]
    const latestAt = Date.parse(latest.at)
    if (now - latestAt > SIGNAL_MS) continue

    const burst = list.filter((c) => latestAt - Date.parse(c.at) < BURST_MS)
    if (burst.length >= 3) {
      out.push({
        id: `${projectId}:burst:${bucket(latestAt)}`,
        kind: "burst",
        severity: 3,
        at: latest.at,
        projectId,
        title: `${latest.name} is pushing hard: ${burst.length} commits in ${minutes(latestAt - Date.parse(burst.at(-1)?.at ?? latest.at))} min`,
        detail: latest.message,
        url: latest.url,
      })
    }

    const older = list.find((c) => latestAt - Date.parse(c.at) >= RETURN_MS)
    if (older && now - latestAt < 30 * MINUTE) {
      out.push({
        id: `${projectId}:return:${latest.sha}`,
        kind: "return",
        severity: 1,
        at: latest.at,
        projectId,
        title: `${latest.name} is back after ${Math.round((latestAt - Date.parse(older.at)) / 36e5)} h`,
        detail: latest.message,
        url: latest.url,
      })
    }

    for (const c of list.slice(0, 4)) {
      const hit = SIGNALS.find(([re]) => re.test(c.message))
      if (!hit) continue
      out.push({
        id: `${projectId}:signal:${c.sha}`,
        kind: "signal",
        severity: 2,
        at: c.at,
        projectId,
        title: `${latest.name}: a commit mentions ${hit[1]}`,
        detail: c.message,
        url: c.url,
      })
      break
    }
  }

  for (const p of pulls) {
    const at = Date.parse(p.at)
    if (now - at > PULL_MS) continue
    const opening = p.state === "open"
    const who = p.projectId ? "A project" : p.repo
    out.push({
      id: `${p.repo}:${p.number}:${p.state}:${bucket(at)}`,
      kind: opening ? "pull" : "merge",
      severity: 1,
      at: p.at,
      projectId: p.projectId,
      title: `${who} ${opening ? "opened" : "merged"} pull request #${p.number}`,
      detail: p.title,
      url: p.url,
    })
  }

  const seen = new Set<string>()
  return out
    .sort((a, b) => b.severity - a.severity || Date.parse(b.at) - Date.parse(a.at))
    .filter((w) => {
      const key = `${w.projectId ?? w.url}:${w.kind}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 8)
}
