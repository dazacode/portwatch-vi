import type { MetadataRoute } from "next"
import { sitemapEntries } from "@/lib/sitemap"
import { getActivity, getEvidence, getMilestones, getNews, getTracker } from "@/lib/tracker"

export const revalidate = 300

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [tracker, news, activity, milestones, evidence] = await Promise.all([
    getTracker(),
    getNews(),
    getActivity(),
    getMilestones(),
    getEvidence(),
  ])
  return sitemapEntries({ tracker, news, activity, milestones, evidence })
}
