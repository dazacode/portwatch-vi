import type { Activity, NewsFile, Tracker } from "@/lib/tracker"

// The data comes from a project whose name and articles aren't shown on this site. It is filtered as it
// is loaded, so the files stay as upstream wrote them and the sync keeps merging cleanly.
const HIDDEN = /portwatch|4lwayz/i

/** True when anything in it, down to image credits and links, names the hidden project. */
export const isHidden = (value: unknown): boolean => HIDDEN.test(JSON.stringify(value) ?? "")

/** Drops whole sentences: "confirmed by …" can't lose its source and stay true. */
export const withoutHidden = (text: string) =>
  text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !HIDDEN.test(sentence))
    .join(" ")

const shown = <T>(list: T[]) => list.filter((item) => !isHidden(item))

export const hideInTracker = (t: Tracker): Tracker => ({
  ...t,
  efforts: t.efforts.map((e) => ({
    ...e,
    summary: withoutHidden(e.summary),
    blockers: shown(e.blockers),
  })),
  news: shown(t.news),
  changes: shown(t.changes),
  headlines: shown(t.headlines),
})

export const hideInNews = (n: NewsFile): NewsFile => ({ ...n, items: shown(n.items) })

export function hideInActivity(a: Activity): Activity {
  const { upstream: _, ...projects } = a.projects
  return {
    ...a,
    projects: Object.fromEntries(
      Object.entries(projects).map(([id, p]) => [
        id,
        { ...p, commits: shown(p.commits), pulls: shown(p.pulls) },
      ])
    ),
    feed: shown(a.feed).filter((item) => item.projectId !== "upstream"),
    discovered: shown(a.discovered),
  }
}
