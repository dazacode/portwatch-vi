import type { Metadata } from "next"
import Link from "next/link"
import { Container } from "@/components/container"
import { ago, utcDay } from "@/lib/format"
import {
  type ActivityCommit,
  getActivity,
  getStandings,
  getTracker,
  type PullRequest,
} from "@/lib/tracker"

export const revalidate = 120
export const metadata: Metadata = { title: "Activity" }

const isPull = (item: PullRequest | ActivityCommit): item is PullRequest => "number" in item
const link = "underline-offset-4 hover:underline"

export default async function Page() {
  const [activity, tracker] = await Promise.all([getActivity(), getTracker()])
  const names = new Map(getStandings(tracker, []).map((s) => [s.id, s.name]))
  const at = new Date().toISOString()
  const pulls = activity.feed.filter(isPull)
  const commits = activity.feed.filter((i): i is ActivityCommit => !isPull(i))
  const open = pulls.filter((p) => p.state === "open")
  const tracked = new Set(tracker.efforts.map((e) => e.repo?.toLowerCase()).filter(Boolean))

  const projectName = (item: PullRequest | ActivityCommit) =>
    (item.projectId && names.get(item.projectId)) || item.repo

  return (
    <Container className="grid gap-x-12 gap-y-10 pt-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div>
        <h1 className="text-2xl font-semibold">Public activity</h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Commits and pull requests from the projects on the board and from anyone else building
          against GTA VI. Scraped from GitHub’s public API every half hour.{" "}
          {activity.updated && (
            <>
              As of {utcDay(activity.updated)}, {ago(activity.updated, at)}.
            </>
          )}
        </p>

        <section className="mt-8">
          <h2 className="border-b pb-1.5 text-lg font-semibold">
            Pull requests{" "}
            <span className="text-sm font-normal text-muted-foreground">({open.length} open)</span>
          </h2>
          {pulls.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nothing scraped yet.</p>
          ) : (
            <ul>
              {pulls.slice(0, 80).map((p) => (
                <li key={`${p.repo}#${p.number}`} className="border-b py-2.5 text-sm">
                  <a href={p.url} target="_blank" rel="noreferrer" className={link}>
                    {p.title}
                  </a>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.projectId ? (
                      <Link href={`/projects/${p.projectId}`} className={link}>
                        {projectName(p)}
                      </Link>
                    ) : (
                      <a
                        href={`https://github.com/${p.repo}`}
                        target="_blank"
                        rel="noreferrer"
                        className={link}
                      >
                        {p.repo}
                      </a>
                    )}{" "}
                    #{p.number} · {p.state}
                    {p.draft ? " draft" : ""} · {p.author || "unknown"} · {utcDay(p.at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="border-b pb-1.5 text-lg font-semibold">Commits</h2>
          {commits.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nothing scraped yet.</p>
          ) : (
            <ul>
              {commits.slice(0, 100).map((c) => (
                <li key={`${c.repo}@${c.sha}`} className="border-b py-2 text-sm">
                  <a href={c.url} target="_blank" rel="noreferrer" className={`${link} font-mono`}>
                    {c.sha}
                  </a>{" "}
                  <span className="text-muted-foreground">{c.message}</span>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {projectName(c)} · {c.author || "unknown"} · {utcDay(c.at)} {ago(c.at, at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="lg:pt-14">
        <h2 className="text-lg font-semibold">Found on GitHub</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Public repositories the harvester found that aren’t on the board. Not endorsed or scored.
        </p>
        <ul className="mt-4">
          {activity.discovered.map((r) => (
            <li key={r.repo} className="border-b py-2.5 text-sm">
              <a href={r.url} target="_blank" rel="noreferrer" className={link}>
                {r.repo}
              </a>
              <span className="block text-xs text-muted-foreground">
                {r.stars} stars · {r.language ?? "unknown language"} · pushed {utcDay(r.pushedAt)}
                {tracked.has(r.repo.toLowerCase()) && " · on the board"}
              </span>
              {r.description && <span className="mt-0.5 block text-xs">{r.description}</span>}
            </li>
          ))}
        </ul>
      </aside>
    </Container>
  )
}
