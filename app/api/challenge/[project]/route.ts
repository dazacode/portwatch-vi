import { challenge, challengeStage, currentWindow } from "@/lib/challenge.mjs"
import { getEvidence, getStandings, getTracker } from "@/lib/tracker"

export async function GET(_: Request, { params }: { params: Promise<{ project: string }> }) {
  // A fixed development-only secret so a fresh clone works on localhost. Production and the
  // GitHub workflow must share the real CHALLENGE_SECRET, or codes issued here won't be recorded.
  const secret =
    process.env.CHALLENGE_SECRET ??
    (process.env.NODE_ENV === "development" ? "viportlive-local-only" : null)
  if (!secret) {
    return Response.json(
      { error: "Challenges are not set up: set CHALLENGE_SECRET in the environment" },
      { status: 503 }
    )
  }
  const { project } = await params
  const [tracker, evidence] = await Promise.all([getTracker(), getEvidence()])
  const standing = getStandings(tracker, evidence).find((s) => s.id === project && !s.nuked)
  if (!standing) return Response.json({ error: "No such project" }, { status: 404 })
  const stage = challengeStage(standing.claimedStage)
  return Response.json(
    { stage, ...challenge(secret, project, stage, currentWindow()) },
    { headers: { "Cache-Control": "public, s-maxage=5" } }
  )
}
