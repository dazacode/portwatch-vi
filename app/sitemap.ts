import type { MetadataRoute } from "next"
import { getIntel, published } from "@/lib/intel"
import { pageUrl } from "@/lib/seo"
import { sitemapEntries } from "@/lib/sitemap"
import { getActivity, getEvidence, getMilestones, getNews, getTracker } from "@/lib/tracker"

export const revalidate = 300

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [tracker, news, activity, milestones, evidence, intel] = await Promise.all([
    getTracker(),
    getNews(),
    getActivity(),
    getMilestones(),
    getEvidence(),
    getIntel(),
  ])
  const base = sitemapEntries({ tracker, news, activity, milestones, evidence })
  const reports = published(intel).map((item) => ({
    url: pageUrl(`/intelligence/${item.id}`),
    lastModified: item.publishedAt ?? item.at,
  }))
  return [...base, ...reports]
}
