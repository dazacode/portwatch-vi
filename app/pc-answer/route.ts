import { answerHtml } from "@/lib/answer-page"
import { getAnswer, getTracker } from "@/lib/tracker"

export const dynamic = "force-static"
export const revalidate = 900

export async function GET() {
  const tracker = await getTracker()
  const { furthest, leader } = getAnswer(tracker)
  const projects = tracker.efforts.filter((e) => !e.nuked).length
  return new Response(
    answerHtml({ now: Date.now(), updated: tracker.scout.lastRun, projects, furthest, leader }),
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  )
}
