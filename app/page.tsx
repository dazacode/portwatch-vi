import Link from "next/link"
import { Container } from "@/components/container"
import { LiveDeck } from "@/components/live/live-deck"
import { StandingsTable } from "@/components/standings-table"
import { getBroadcast } from "@/lib/broadcast"
import { utcDay, utcTime } from "@/lib/format"
import { getSnapshot } from "@/lib/live/snapshot"
import { getAnswer, getChanges, getStandings, getTracker } from "@/lib/tracker"

export const revalidate = 60

const more = "text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"

export default async function Page() {
  const [tracker, snapshot, broadcast] = await Promise.all([
    getTracker(),
    getSnapshot(),
    getBroadcast(),
  ])
  const standings = getStandings(tracker)
  const answer = getAnswer(tracker)
  const verdict = answer.done ? "Yes." : "Not properly yet."
  const projects = Object.fromEntries(standings.map((s) => [s.id, s.name]))

  return (
    <>
      <h1 className="sr-only">
        Does GTA VI run on PC? {verdict} The furthest any project claims is “
        {answer.furthest.toLowerCase()}”.
      </h1>
      <LiveDeck
        initial={snapshot}
        broadcast={broadcast}
        projects={projects}
        answer={`GTA VI on PC? ${verdict}`}
      />
      <Container>
        <section className="mt-12" aria-labelledby="standings">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 id="standings" className="text-lg font-semibold">
              Standings
            </h2>
            <Link href="/standings" className={more}>
              All {standings.length} projects
            </Link>
          </div>
          <StandingsTable
            rows={standings.filter((s) => s.tier === "tracked" && !s.nuked).slice(0, 8)}
          />
        </section>

        <section className="mt-12 grid gap-10 md:grid-cols-2" aria-label="News and changes">
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">Headlines</h2>
              <Link href="/news" className={more}>
                All news
              </Link>
            </div>
            <ul>
              {tracker.headlines.slice(0, 6).map((h) => (
                <li key={h.link} className="border-b py-2.5 text-sm">
                  <a
                    href={h.link}
                    target="_blank"
                    rel="noreferrer"
                    className="underline-offset-4 hover:underline"
                  >
                    {h.title}
                  </a>
                  <span className="block text-xs text-muted-foreground">
                    {h.outlet}, {utcDay(h.date)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="mb-2 text-lg font-semibold">What changed</h2>
            <ul>
              {getChanges(tracker, 6).map((c) => (
                <li key={c.date + c.text} className="border-b py-2.5 text-sm">
                  <span className="line-clamp-3">{c.text}</span>
                  <span className="text-xs text-muted-foreground">{utcDay(c.date)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <p className="mt-8 text-xs text-muted-foreground">
          Project data updated {utcDay(tracker.scout.lastRun)}, {utcTime(tracker.scout.lastRun)}.
        </p>
      </Container>
    </>
  )
}
