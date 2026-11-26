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
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Dozens of groups are trying to get the console game running on PC, and their claims are
        spread across GitHub, streams and social media. This page puts them in one place. Projects
        are ranked by what we can check: their own GitHub (code, README and commits), what they post
        and stream on social media, and findings from other people. We aren’t the only or the
        official verifier: everything here is scouted from public sources. If you’re behind a
        project and its score or place looks wrong, you can vouch for a change:{" "}
        <Link href="/verify" className="underline underline-offset-4 hover:text-stripe-1">
          prove it live
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
