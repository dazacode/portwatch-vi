import { getIntel } from "@/lib/intel"
import { intelFeed } from "@/lib/intel-feed"

export const dynamic = "force-static"
export const revalidate = 60

export async function GET() {
  return new Response(intelFeed(await getIntel()), {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  })
}
