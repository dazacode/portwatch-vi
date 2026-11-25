import { answerSitemap } from "@/lib/answer-page"
import { getTracker } from "@/lib/tracker"

export const dynamic = "force-static"
export const revalidate = 900

export async function GET() {
  const { scout } = await getTracker()
  return new Response(answerSitemap(scout.lastRun), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  })
}
