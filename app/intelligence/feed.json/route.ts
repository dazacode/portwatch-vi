import { getIntel } from "@/lib/intel"
import { jsonFeed } from "@/lib/intel-feed"

export const dynamic = "force-static"
export const revalidate = 60

export async function GET() {
  return Response.json(jsonFeed(await getIntel()), {
    headers: { "Content-Type": "application/feed+json; charset=utf-8" },
  })
}
