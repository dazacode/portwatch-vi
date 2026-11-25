import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Confidence } from "@/components/confidence"
import { Container } from "@/components/container"
import { utcDay } from "@/lib/format"
import { type Evidence, getEvidence, getStandings, getTracker, LADDER } from "@/lib/tracker"

export const revalidate = 300

type Props = { params: Promise<{ id: string }> }

async function getProject(id: string) {
  const [tracker, evidence] = await Promise.all([getTracker(), getEvidence()])
  const standing = getStandings(tracker, evidence).find((s) => s.id === id)
  return standing && { standing, evidence: evidence.filter((e) => e.effortId === id) }
}

export async function generateStaticParams() {
  return (await getTracker()).efforts.map(({ id }) => ({ id }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = await getProject((await params).id)
  return { title: project?.standing.name ?? "Project" }
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
  const { standing: s, evidence } = project
  return (
    <Container className="pt-8">
      <Link
        href="/standings"
        className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        Standings
      </Link>
      <h1 className="mt-2 text-3xl font-bold">{s.name}</h1>
      <p className="mt-2 max-w-prose text-muted-foreground">{s.summary}</p>
      <dl className="mt-6 flex flex-wrap gap-x-12 gap-y-4">
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
      <div className="mt-10 grid gap-x-12 gap-y-10 lg:grid-cols-2">
        <section>
          <h2 className="mb-4 text-lg font-semibold">How sure we are</h2>
          <Confidence stages={s.checks} claimed={s.steps} />
        </section>
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
            <ul>
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
    </Container>
  )
}
