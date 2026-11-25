import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Breadcrumb } from "@/components/breadcrumb"
import { Confidence } from "@/components/confidence"
import { Container } from "@/components/container"
import { Goals } from "@/components/goals"
import { ScoreBreakdown } from "@/components/score-breakdown"
import { ago, utcDay } from "@/lib/format"
import { pageMeta, projectMeta } from "@/lib/seo"
import { SOURCE } from "@/lib/site"
import {
  type Evidence,
  getActivity,
  getEvidence,
  getStandings,
  getTracker,
  LADDER,
} from "@/lib/tracker"

export const revalidate = 300

type Props = { params: Promise<{ id: string }> }

async function getProject(id: string) {
  const [tracker, evidence, activity] = await Promise.all([
    getTracker(),
    getEvidence(),
    getActivity(),
  ])
  const standing = getStandings(tracker, evidence).find((s) => s.id === id)
  return (
    standing && {
      standing,
      evidence: evidence.filter((e) => e.effortId === id),
      activity: activity.projects[id],
    }
  )
}

export async function generateStaticParams() {
  return (await getTracker()).efforts.map(({ id }) => ({ id }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = await getProject((await params).id)
  return project ? pageMeta(projectMeta(project.standing)) : notFound()
}

const KIND: Record<Evidence["kind"], string> = {
  challenge: "Live challenge",
  tester: "Independent tester",
  contributor: "Tester who contributed code",
  rule: "Independent tester, matched by text rules",
}

const stageName = (key: string) => LADDER.find((m) => m.key === key)?.label ?? key

export default async function Page({ params }: Props) {
  const project = await getProject((await params).id)
  if (!project) notFound()
  const { standing: s, evidence, activity } = project
  return (
    <Container className="pt-8 wrap-anywhere">
      <Breadcrumb
        parent={{ name: "Standings", path: "/standings" }}
        page={{ name: s.name, path: `/projects/${s.id}` }}
      />
      <h1 className="mt-2 text-3xl font-bold">{s.name}</h1>
      <p className="mt-2 max-w-prose text-muted-foreground">{s.summary}</p>
      <dl className="mt-6 flex flex-wrap gap-x-12 gap-y-4">
        <div>
          <dt className="text-sm text-muted-foreground">Score</dt>
          <dd className="text-4xl font-extrabold">{s.rating}%</dd>
          <dd className="text-sm">
            <Link href="/method" className="underline underline-offset-4">
              How it is worked out
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Claimed</dt>
          <dd className="text-4xl font-extrabold">{s.score}%</dd>
          <dd className="text-sm">{s.stage}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Verified</dt>
          <dd className="text-4xl font-extrabold">{s.verified}%</dd>
          <dd className="text-sm">{s.verifiedStage ?? "Nothing yet"}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{SOURCE.name}</dt>
          <dd className="text-4xl font-extrabold">
            {s.sourceScore === null ? "–" : `${s.sourceScore}%`}
          </dd>
          <dd className="text-sm">
            {s.sourceScore === null
              ? "Not listed there"
              : s.sourceScore === s.score
                ? "The same claim"
                : "We have newer findings"}
          </dd>
        </div>
      </dl>
      <p className="mt-4 flex flex-wrap gap-x-5 text-sm">
        {s.url && (
          <a href={s.url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
            Code on GitHub
          </a>
        )}
        {!s.nuked && s.steps[2] > 0 && (
          <Link href="/verify" className="underline underline-offset-4">
            Prove a run live
          </Link>
        )}
      </p>
      {s.findings.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-2 text-lg font-semibold">Findings</h2>
          <p className="mb-3 max-w-prose text-sm text-muted-foreground">
            {s.findingsSource ?? "From the project’s own reports."}
          </p>
          <ul className="pane px-5 py-1 *:last:border-0">
            {s.findings.map((f) => (
              <li key={f.text} className="border-b py-3 text-sm">
                {f.text}
                {f.url && (
                  <>
                    {" "}
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-4 hover:text-foreground"
                    >
                      Source
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="mt-10 grid gap-x-12 gap-y-10 lg:grid-cols-2">
        {s.parts.length > 0 && (
          <section>
            <h2 className="mb-4 text-lg font-semibold">How the score adds up</h2>
            <ScoreBreakdown parts={s.parts} />
          </section>
        )}
        <section>
          <h2 className="mb-4 text-lg font-semibold">How sure we are</h2>
          <Confidence stages={s.checks} claimed={s.steps} />
        </section>
        {s.steps[4] >= 1 && (
          <section>
            <h2 className="mb-4 text-lg font-semibold">Past runnable</h2>
            <Goals goals={s.goals} />
          </section>
        )}
        <section>
          <h2 className="mb-2 text-lg font-semibold">Evidence</h2>
          {evidence.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No independent reports yet.{" "}
              {s.isPrivate
                ? "Its code isn’t public, so only a live challenge can verify it."
                : "Reports in its issues are read every three hours."}
            </p>
          ) : (
            <ul className="pane px-5 py-1 mt-3 *:last:border-0">
              {evidence.map((e) => (
                <li key={e.url + e.at} className="border-b py-3 text-sm">
                  <p className="flex flex-wrap justify-between gap-x-4">
                    <span className="font-medium">
                      {e.outcome === "failed" ? "Could not reach: " : ""}
                      {stageName(e.stage)}
                    </span>
                    <span className="text-muted-foreground">{utcDay(e.at)}</span>
                  </p>
                  {e.quote && <p className="mt-1">“{e.quote}”</p>}
                  <p className="mt-1 text-muted-foreground">
                    {KIND[e.kind]}
                    {e.gpu && `, ${e.gpu}`}
                    {e.commit && `, commit ${e.commit}`}.{" "}
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-4 hover:text-foreground"
                    >
                      Source
                    </a>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {activity && (activity.pulls.length > 0 || activity.commits.length > 0) && (
        <section className="mt-10">
          <h2 className="mb-2 text-lg font-semibold">Public activity</h2>
          <p className="text-sm text-muted-foreground">
            Scraped from the project’s public repository. {activity.openPrs} open pull
            {activity.openPrs === 1 ? " request" : " requests"} right now.
          </p>
          {activity.pulls.length > 0 && (
            <ul className="pane px-5 py-1 mt-4 *:last:border-0">
              {activity.pulls.slice(0, 12).map((p) => (
                <li key={p.number} className="border-b py-2 text-sm">
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline-offset-4 hover:underline"
                  >
                    #{p.number} {p.title}
                  </a>
                  <span className="block text-xs text-muted-foreground">
                    {p.state}
                    {p.draft ? " draft" : ""}, {p.author || "unknown"}, {utcDay(p.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {activity.commits.length > 0 && (
            <ul className="pane px-5 py-1 mt-4 *:last:border-0">
              {activity.commits.slice(0, 12).map((c) => (
                <li key={c.sha} className="border-b py-2 text-sm">
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono underline-offset-4 hover:underline"
                  >
                    {c.sha}
                  </a>{" "}
                  <span className="text-muted-foreground">{c.message}</span>
                  <span className="block text-xs text-muted-foreground">
                    {c.author || "unknown"}, {ago(c.at, new Date().toISOString())}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </Container>
  )
}
