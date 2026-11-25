import { getBoard } from "@/lib/board"
import { feedXml } from "@/lib/feed"
import { getTracker } from "@/lib/tracker"

export const dynamic = "force-static"
export const revalidate = 300

export async function GET() {
  const [{ news }, board] = await Promise.all([getTracker(), getBoard()])
  return new Response(feedXml(news, board), {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  })
}
