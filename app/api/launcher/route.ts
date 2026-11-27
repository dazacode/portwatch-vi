import { isHidden } from "@/lib/hide"
import { type Effort, getTracker } from "@/lib/tracker"

// The project list VILauncher reads, in the shape of upstream's tracker so the launcher can fall back to
// it unchanged. Our findings are on top and hidden text is gone, as on the site.
export const dynamic = "force-static"
export const revalidate = 300

/** Upstream fields the launcher reads that the site has no use for. */
type Listed = Effort & { branch?: string | null; highlights?: string[] }

const entry = ({
  id,
  name,
  repo,
  branch,
  tier,
  gpu,
  verification,
  summary,
  highlights,
  blockers,
  gta,
  stats,
  mirror,
  nuked,
}: Listed) => ({
  id,
  name,
  repo,
  branch: branch ?? null,
  tier,
  gpu: gpu ?? [],
  verification,
  summary,
  highlights: (highlights ?? []).filter((line) => !isHidden(line)),
  blockers,
  gta,
  stats,
  mirror: mirror ?? null,
  nuked: nuked ?? null,
})

export async function GET() {
  const tracker = await getTracker()
  return Response.json(
    {
      updated: tracker.updated,
      source: "VIPortLive",
      efforts: (tracker.efforts as Listed[]).map(entry),
    },
    { headers: { "Access-Control-Allow-Origin": "*" } }
  )
}
