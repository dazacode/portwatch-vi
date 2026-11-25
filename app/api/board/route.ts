import { getBoard, isRecent } from "@/lib/board"

export const dynamic = "force-static"
export const revalidate = 60

/** What the site-wide notice may announce. */
export async function GET() {
  const now = Date.now()
  return Response.json((await getBoard()).filter((e) => isRecent(e, 2, now)).slice(0, 10))
}
