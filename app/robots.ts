import type { MetadataRoute } from "next"
import { pageUrl } from "@/lib/seo"

// The data under /api stays readable, because pages fetch it. Its header keeps it out of results.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" }, sitemap: pageUrl("/sitemap.xml") }
}
