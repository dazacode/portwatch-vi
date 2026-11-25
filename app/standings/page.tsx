import type { Metadata } from "next"
import { Container } from "@/components/container"
import { StandingsTable } from "@/components/standings-table"
import { getStandings, getTracker } from "@/lib/tracker"

export const revalidate = 300
export const metadata: Metadata = { title: "Standings" }

export default async function Page() {
  const rows = getStandings(await getTracker())
  const groups = [
    { title: "In the race", rows: rows.filter((r) => r.tier === "tracked" && !r.nuked) },
    { title: "Early or stalled", rows: rows.filter((r) => r.tier === "watchlist" && !r.nuked) },
    { title: "Taken offline", rows: rows.filter((r) => r.nuked) },
  ]
  return (
    <Container>
      <h1 className="pt-8 text-2xl font-semibold">Standings</h1>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        Most results are reported by the projects themselves. Those are marked unverified until
        someone else reproduces them.
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
