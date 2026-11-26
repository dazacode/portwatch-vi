import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { Container } from "@/components/container"
import { JsonLd } from "@/components/json-ld"
import { Board } from "@/components/standings/board"
import { Explorer, ExplorerFallback } from "@/components/standings/explorer"
import { ProjectRow } from "@/components/standings/project-row"
import { getBoardEvents } from "@/lib/board"
import { getRace, type RateAt } from "@/lib/race"
import { scoreAt } from "@/lib/score-at"
import { pageMeta, standingsLd, standingsMeta } from "@/lib/seo"
import { SITE } from "@/lib/site"
import { STEPS } from "@/lib/stages.mjs"
import { getProjects, type Project, toEntry } from "@/lib/standings"
import {
  getActivity,
  getEvidence,
  getMilestones,
  getRecords,
  getStandings,
  getTracker,
} from "@/lib/tracker"

export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  return pageMeta({
    ...standingsMeta((await getTracker()).efforts.length),
    // The race as it stands, drawn fresh from the board.
    image: {
      url: "/race/wide/image",
      width: 1600,
      height: 900,
      alt: "GTA VI on PC, the race: the leader and the chasing pack by our score",
    },
  })
}

export default async function Page() {
  const [tracker, records, evidence, activity, milestones] = await Promise.all([
    getTracker(),
    getRecords(),
    getEvidence(),
    getActivity(),
    getMilestones(),
  ])
  const standings = getStandings(tracker, evidence)
  const sources = { tracker: records, activity, milestones, evidence }
  const projects = getProjects(standings, sources)
  const board = getBoardEvents(projects, records, milestones)
  const now = new Date().toISOString()
  const stages = STEPS.filter((m) => m.at > 0).map(({ label, at }) => ({ label, at }))
  // Our score at each moment of the race: the claim then, and the reports filed by then. Only the
  // total is drawn, so the parts stay on the server.
  const rateAt: RateAt = (p, claim, at) => ({
    rating:
      at === now
        ? p.rating
        : scoreAt(
            claim,
            evidence.filter((e) => e.effortId === p.id && Date.parse(e.at) <= Date.parse(at)),
            p.parts
          ).rating,
    parts: [],
  })
  const draw = (list: Project[]) => ({
    race: getRace(list, milestones, board, now, rateAt),
    playable:
      list.find((p) => p.rank !== null && p.goals.some((g) => g.key === "smooth" && g.met))?.name ??
      null,
    entries: list.map(toEntry),
    board: <Board projects={list} />,
    rows: Object.fromEntries(list.map((p) => [p.id, <ProjectRow key={p.id} project={p} />])),
  })
  const view = {
    ranked: draw(projects),
    everyone: draw(getProjects(standings, sources, { withPrivate: true })),
  }
  return (
    <Container className="pt-8">
      <JsonLd data={standingsLd(projects)} />
      <h1 className="text-2xl font-semibold">Standings</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
        Fan projects trying to run the console game on PC, ranked by what we can check: their code,
        their posts and streams, and outside reports. We aren’t the official verifier. Behind a
        project?{" "}
        <Link href="/verify" className="underline underline-offset-4 hover:text-stripe-1">
          Prove it live
        </Link>{" "}
        or{" "}
        <a
          href={`https://github.com/${SITE.repo}/issues`}
          className="underline underline-offset-4 hover:text-stripe-1"
        >
          open an issue
        </a>
        .
      </p>
      <Suspense fallback={<ExplorerFallback {...view} stages={stages} />}>
        <Explorer {...view} stages={stages} />
      </Suspense>
    </Container>
  )
}
