// Our findings on top of upstream's tracker, kept in data/overrides.json so data/tracker.json stays
// exactly as upstream wrote it. Shared by the site and the scripts.
import { scoreEffort } from "./scoring.mjs"

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
const fold = (s) => String(s ?? "").toLowerCase()

const get = (effort, path) => path.split(".").reduce((at, key) => at?.[key], effort)

function set(effort, path, value) {
  const [key, sub] = path.split(".")
  return { ...effort, [key]: sub ? { ...effort[key], [sub]: value } : value }
}

/** A remote file is used only if it has what the pages read. A change of shape must not take them down. */
export function isTracker(t) {
  return (
    Boolean(t) &&
    typeof t.updated === "string" &&
    Array.isArray(t.efforts) &&
    t.efforts.length > 0 &&
    t.efforts.every(
      (e) =>
        typeof e?.id === "string" &&
        typeof e.name === "string" &&
        typeof e.summary === "string" &&
        Array.isArray(e.blockers) &&
        Boolean(e.gta) &&
        Boolean(e.stats)
    ) &&
    ["news", "changes", "headlines", "dmca", "flagged"].every((key) => Array.isArray(t[key])) &&
    Boolean(t.exe) &&
    typeof t.scout?.lastRun === "string"
  )
}

/**
 * Upstream wins. A patch holds only while every value it replaced is still the one it was written
 * against. Once upstream changes any of them, the whole patch lapses, so old words never sit next to a
 * new number. A project we added gives way as soon as upstream lists it.
 * Returns the tracker, and each patch that lapsed with the reason.
 */
export function applyOverrides(tracker, overrides) {
  const lapsed = []
  const changes = []
  const efforts = new Map(
    tracker.efforts.map((e) => [e.id, { ...e, sourceScore: scoreEffort(e).score }])
  )

  for (const patch of overrides?.patches ?? []) {
    const effort = efforts.get(patch.id)
    const moved = effort
      ? Object.keys(patch.from).filter((path) => !same(get(effort, path), patch.from[path]))
      : []
    if (!effort || moved.length > 0) {
      // Already what we said: nothing to report.
      const agreed = effort && Object.entries(patch.to).every(([p, v]) => same(get(effort, p), v))
      if (!agreed) {
        const why = effort ? `upstream changed ${moved.join(", ")}` : "upstream no longer lists it"
        lapsed.push({ id: patch.id, why })
      }
      continue
    }
    let next = effort
    for (const [path, value] of Object.entries(patch.to)) next = set(next, path, value)
    efforts.set(patch.id, next)
    changes.push(...(patch.changes ?? []))
  }

  for (const { effort, changes: told } of overrides?.added ?? []) {
    const taken = tracker.efforts.find(
      (e) =>
        e.id === effort.id ||
        fold(e.name) === fold(effort.name) ||
        (effort.repo && fold(e.repo) === fold(effort.repo)) ||
        (effort.related ?? []).some((repo) => fold(e.repo) === fold(repo))
    )
    if (taken) {
      lapsed.push({ id: effort.id, why: `upstream lists it now, as ${taken.id}` })
      continue
    }
    efforts.set(effort.id, { ...effort, sourceScore: null })
    changes.push(...(told ?? []))
  }

  // Dates are days. The sort is stable, so within a day upstream's entries come first.
  const merged = [...tracker.changes, ...changes].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0
  )
  const pick = overrides?.pick ?? null
  return { tracker: { ...tracker, efforts: [...efforts.values()], changes: merged, pick }, lapsed }
}
