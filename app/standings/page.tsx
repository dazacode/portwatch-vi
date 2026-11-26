import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { Container } from "@/components/container"
import { JsonLd } from "@/components/json-ld"
import { Board } from "@/components/standings/board"
import { Explorer, ExplorerFallback } from "@/components/standings/explorer"
import { ProjectRow } from "@/components/standings/project-row"
import { getBoardEvents } from "@/lib/board"
import { getRace } from "@/lib/race"
import type { Ours } from "@/lib/score-colors"
import { pageMeta, standingsLd, standingsMeta } from "@/lib/seo"
import { SITE } from "@/lib/site"
import { STEPS } from "@/lib/stages.mjs"
import { getProjects, isGone, type Project, toEntry } from "@/lib/standings"
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
  const draw = (list: Project[]) => {
    const race = getRace(list, milestones, board, now)
    const ours = (p: Project): Ours => ({
      name: p.name,
      rating: p.rating,
      parts: p.parts.map(({ key, label, claimed, counted }) => ({ key, label, claimed, counted })),
    })
    // Only who is ever in a lane: the rest isn't drawn.
    const seen = new Set(race.flatMap((f) => f.racers.map((r) => r.id)))
    const scores = Object.fromEntries(
      list.filter((p) => seen.has(p.id)).map((p) => [p.id, ours(p)])
    )
    const top = list
      .filter((p) => p.rank !== null && !isGone(p))
      .toSorted((a, b) => b.rating - a.rating)[0]
    return {
      race,
      scores,
      best: top ? { id: top.id, ...ours(top) } : undefined,
      entries: list.map(toEntry),
      board: <Board projects={list} />,
      rows: Object.fromEntries(list.map((p) => [p.id, <ProjectRow key={p.id} project={p} />])),
    }
  }
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
