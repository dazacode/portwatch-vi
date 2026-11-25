import { getSnapshot } from "@/lib/live/snapshot"

// Regenerated at most once a minute however many people are watching, so visitor
// traffic never reaches the platforms' rate limits. Needs no cron job.
export const dynamic = "force-static"
export const revalidate = 60

export async function GET() {
  return Response.json(await getSnapshot())
}
