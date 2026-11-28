import type { MetadataRoute } from "next"
import type { Milestone } from "@/lib/milestones"
import { pageUrl } from "@/lib/seo"
import type { Activity, Evidence, NewsFile, Tracker } from "@/lib/tracker"

type Sources = {
  tracker: Tracker
  news: Pick<NewsFile, "updated">
  activity: Pick<Activity, "updated" | "projects">
  milestones: Pick<Milestone, "id" | "at">[]
  evidence: Pick<Evidence, "effortId" | "at">[]
}

const newest = (dates: (string | null | undefined)[]) =>
  dates
    .filter((d): d is string => Boolean(d) && Number.isFinite(Date.parse(d as string)))
    .sort((a, b) => Date.parse(b) - Date.parse(a))
    .at(0)

/** Every page that can be indexed. A date only where the data has one: the page's own newest entry. */
export function sitemapEntries(sources: Sources, now = Date.now()): MetadataRoute.Sitemap {
  const { tracker, news, activity, milestones, evidence } = sources
  const page = (path: string, ...dates: (string | null | undefined)[]) => {
    // Commit dates are set by whoever commits, so one from the future can't be right.
    const at = newest(dates.filter((d) => !d || Date.parse(d) <= now))
    return { url: pageUrl(path), ...(at && { lastModified: at }) }
  }
  const board = [tracker.updated, tracker.scout.lastRun]
  return [
    page("/", ...board, news.updated),
    page("/standings", ...board),
    page("/news", news.updated, activity.updated, ...tracker.news.map((n) => n.date)),
    page("/verify"),
    page("/can-i-run-it"),
    page("/projects/launcher"),
    page("/method"),
    page("/top-20"),
    ...tracker.efforts.map((e) => {
      const own = activity.projects[e.id]
      return page(
        `/projects/${e.id}`,
        e.nuked?.at,
        ...milestones.filter((m) => m.id === e.id).map((m) => m.at),
        ...evidence.filter((x) => x.effortId === e.id).map((x) => x.at),
        ...(own ? [...own.commits, ...own.pulls].map((x) => x.at) : [])
      )
    }),
    ...tracker.news.map((n) => page(`/news/${n.id}`, n.date)),
  ]
}
