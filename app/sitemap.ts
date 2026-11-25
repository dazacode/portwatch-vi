import type { MetadataRoute } from "next"
import { SITE } from "@/lib/site"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { getTracker } = await import("@/lib/tracker")
  const tracker = await getTracker()
  return [
    "",
    "/standings",
    "/news",
    "/activity",
    "/verify",
    "/method",
    ...tracker.news.map((n) => `/news/${n.id}`),
  ].map((path) => ({ url: SITE.url + path }))
}
