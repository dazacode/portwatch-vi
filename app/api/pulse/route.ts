import { getLiveCommits } from "@/lib/broadcast"

// Rebuilt at most every ten seconds, however many people are watching. The feed itself is read
// from GitHub on demand; no cron job and no branch sit in the path.
export const dynamic = "force-static"
export const revalidate = 10

export async function GET() {
  return Response.json(await getLiveCommits(), {
    headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20" },
  })
}
