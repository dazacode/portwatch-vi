import type { Metadata } from "next"
import { Suspense } from "react"
import { Container } from "@/components/container"
import { JsonLd } from "@/components/json-ld"
import { Board } from "@/components/standings/board"
import { Explorer, ExplorerFallback } from "@/components/standings/explorer"
import { ProjectRow } from "@/components/standings/project-row"
import { getBoardEvents } from "@/lib/board"
import { getRace } from "@/lib/race"
import { pageMeta, standingsLd, standingsMeta } from "@/lib/seo"
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
  return pageMeta(standingsMeta((await getTracker()).efforts.length))
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
  const draw = (list: Project[]) => ({
    race: getRace(list, milestones, board, now),
    entries: list.map(toEntry),
    board: <Board projects={list} />,
    rows: Object.fromEntries(list.map((p) => [p.id, <ProjectRow key={p.id} project={p} />])),
  })
  const view = {
    ranked: draw(projects),
    everyone: draw(getProjects(standings, sources, { withPrivate: true })),
  }
  // The furthest claim isn't always first by score, and this says who is.
  const [first] = projects
  const furthest = view.ranked.race.at(-1)?.racers[0]
  const note =
    first && furthest && first.id !== furthest.id
      ? `First by score: ${first.name}, ${first.rating}%.`
      : undefined
  const stages = STEPS.filter((m) => m.at > 0).map(({ label, at }) => ({ label, at }))
  return (
    <Container className="pt-8">
      <JsonLd data={standingsLd(projects)} />
      <h1 className="text-2xl font-semibold">Standings</h1>
      <Suspense fallback={<ExplorerFallback {...view} stages={stages} note={note} />}>
        <Explorer {...view} stages={stages} note={note} />
      </Suspense>
    </Container>
  )
}
