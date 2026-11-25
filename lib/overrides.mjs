// Our findings on top of upstream's tracker, kept in data/overrides.json so data/tracker.json stays
// exactly as upstream wrote it. Shared by the site and the scripts.
import { scoreEffort } from "./scoring.mjs"

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
const fold = (s) => String(s ?? "").toLowerCase()

export const getPath = (effort, path) => path.split(".").reduce((at, key) => at?.[key], effort)

/** A copy with one dotted path replaced. Two levels are enough for the fields a patch touches. */
export function setPath(effort, path, value) {
  const [key, sub] = path.split(".")
  return { ...effort, [key]: sub ? { ...effort[key], [sub]: value } : value }
}

/** One patch on top of an effort, in the order the patches are written. */
export const applyPatch = (effort, patch) =>
  Object.entries(patch.to).reduce((next, [path, value]) => setPath(next, path, value), effort)

/** Every `from` path of the patches that no longer matches. Empty means the patches still hold. */
export function movedPaths(effort, patches) {
  const moved = []
  let next = effort
  for (const patch of patches) {
    moved.push(
      ...Object.keys(patch.from).filter((path) => !same(getPath(next, path), patch.from[path]))
    )
    next = applyPatch(next, patch)
  }
  return moved
}

/** The same date-ordered change log, with ours added. */
const mergeChanges = (theirs, ours) =>
  [...theirs, ...ours].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

const unique = (items, key) => {
  const seen = new Set()
  return items.filter((item) => {
    const value = typeof key === "function" ? key(item) : item?.[key]
    if (value == null || seen.has(value)) return false
    seen.add(value)
    return true
  })
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
  const added = []
  const efforts = new Map(
    tracker.efforts.map((e) => [e.id, { ...e, sourceScore: scoreEffort(e).score }])
  )

  // Patches apply in file order: a later one can build on an earlier one's values.
  for (const patch of overrides?.patches ?? []) {
    const effort = efforts.get(patch.id)
    if (!effort) {
      lapsed.push({ id: patch.id, why: "upstream no longer lists it" })
      continue
    }
    const moved = Object.keys(patch.from).filter(
      (path) => !same(getPath(effort, path), patch.from[path])
    )
    if (moved.length > 0) {
      // Already what we said: nothing to report.
      const agreed = Object.entries(patch.to).every(([path, v]) => same(getPath(effort, path), v))
      if (!agreed) lapsed.push({ id: patch.id, why: `upstream changed ${moved.join(", ")}` })
      continue
    }
    efforts.set(patch.id, applyPatch(effort, patch))
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
    added.push(effort.id)
    changes.push(...(told ?? []))
  }

  // Ours sits in front of upstream's, newest first. Removals are recorded, because the next sync
  // brings upstream's file back whole.
  const removedNews = new Set(overrides?.removedNews ?? [])
  const news = unique([...(overrides?.news ?? []), ...(tracker.news ?? [])], "id")
    .filter((n) => !removedNews.has(n.id))
    .slice(0, 40)
  const decided = new Set(overrides?.decided ?? [])
  const candidates = (tracker.candidates ?? []).filter(
    (c) => !decided.has(c.repo) && !decided.has(c.id)
  )
  const ignored = unique([...(overrides?.ignored ?? []), ...(tracker.ignored ?? [])], (i) =>
    fold(i.repo)
  )

  // Dates are days. The sort is stable, so within a day upstream's entries come first.
  const pick = overrides?.pick ?? null
  return {
    tracker: {
      ...tracker,
      efforts: [...efforts.values()],
      changes: mergeChanges(tracker.changes ?? [], changes),
      news,
      candidates,
      ignored,
      added,
      pick,
    },
    lapsed,
  }
}
