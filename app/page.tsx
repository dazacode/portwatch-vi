import Link from "next/link"
import { Container } from "@/components/container"
import { DigestSummary } from "@/components/digest/summary"
import { JsonLd } from "@/components/json-ld"
import { LiveDeck } from "@/components/live/live-deck"
import { StandingsTable } from "@/components/standings-table"
import { getBroadcast } from "@/lib/broadcast"
import { getDigest, getSummary } from "@/lib/digest"
import { utcDay, utcTime } from "@/lib/format"
import { getSnapshot } from "@/lib/live/snapshot"
import { HOME, pageMeta, websiteLd } from "@/lib/seo"
import { getProjects } from "@/lib/standings"
import {
  getActivity,
  getAnswer,
  getChanges,
  getEvidence,
  getMilestones,
  getNews,
  getStandings,
  getTracker,
} from "@/lib/tracker"

export const revalidate = 60
export const metadata = pageMeta({ ...HOME, path: "/" })

const more = "text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"

export default async function Page() {
  const [tracker, evidence, snapshot, broadcast, feed, activity, milestones, digest] =
    await Promise.all([
      getTracker(),
      getEvidence(),
      getSnapshot(),
      getBroadcast(),
      getNews(),
      getActivity(),
      getMilestones(),
      getDigest(),
    ])
  const standings = getStandings(tracker, evidence)
  // The same ranking as /standings: public code only.
  const ranked = getProjects(standings, { tracker, activity, milestones, evidence }).filter(
    (p) => p.rank !== null
  )
  const answer = getAnswer(tracker)
  const verdict = answer.done ? "Yes." : "Not yet."
  const projects = Object.fromEntries(standings.map((s) => [s.id, s.name]))

  return (
    <>
      <JsonLd data={websiteLd()} />
      <h1 className="sr-only">
        Does GTA VI run on PC? {verdict} The furthest any project claims is “
        {answer.furthest.toLowerCase()}”.
      </h1>
      <LiveDeck
        initial={snapshot}
        broadcast={broadcast}
        projects={projects}
        answer={`GTA VI on PC? ${verdict}`}
        done={answer.done}
      />
      <Container>
        <DigestSummary summary={getSummary(digest, feed, tracker)} compact />

        <section className="mt-12" aria-labelledby="standings">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 id="standings" className="text-lg font-semibold">
              Standings
            </h2>
            <Link href="/standings" className={more}>
              All {standings.length} projects
            </Link>
          </div>
          <StandingsTable rows={ranked.slice(0, 8)} />
        </section>

        <section
          className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-10 md:grid-cols-[repeat(2,minmax(0,1fr))]"
          aria-label="News and changes"
        >
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">Headlines</h2>
              <Link href="/news" className={more}>
                All news
              </Link>
            </div>
            <ul className="pane px-5 py-2 wrap-anywhere">
              {feed.items.slice(0, 6).map((h) => (
                <li key={h.id} className="border-b py-2.5 text-sm last:border-0">
                  <a
                    href={h.url}
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
            <ul className="pane px-5 py-2 wrap-anywhere">
              {getChanges(tracker, 6).map((c) => (
                <li key={c.date + c.text} className="border-b py-2.5 text-sm last:border-0">
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
