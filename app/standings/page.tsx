import type { Metadata } from "next"
import { Container } from "@/components/container"
import { StandingsTable } from "@/components/standings-table"
import { getEvidence, getStandings, getTracker } from "@/lib/tracker"

export const revalidate = 300
export const metadata: Metadata = { title: "Standings" }

export default async function Page() {
  const [tracker, evidence] = await Promise.all([getTracker(), getEvidence()])
  const rows = getStandings(tracker, evidence)
  const groups = [
    { title: "In the race", rows: rows.filter((r) => r.tier === "tracked" && !r.nuked) },
    { title: "Early or stalled", rows: rows.filter((r) => r.tier === "watchlist" && !r.nuked) },
    { title: "Taken offline", rows: rows.filter((r) => r.nuked) },
  ]
  return (
    <Container>
      <h1 className="pt-8 text-2xl font-semibold">Standings</h1>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        Claimed is what a project says. Verified is what independent people have shown, and it
        decides the order. Open a project to see its evidence.
      </p>
      {groups.map((g) =>
        g.rows.length ? (
          <section key={g.title} className="mt-10">
            <h2 className="mb-2 text-lg font-semibold">{g.title}</h2>
            <StandingsTable rows={g.rows} detailed />
          </section>
        ) : null
      )}
    </Container>
  )
}
