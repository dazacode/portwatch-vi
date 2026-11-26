import Link from "next/link"
import { Suspense } from "react"
import { BoardList } from "@/components/board/list"
import { Container } from "@/components/container"
import { Stories, StoriesFallback } from "@/components/digest/stories"
import { DigestSummary } from "@/components/digest/summary"
import { IntelCard } from "@/components/intel/card"
import { AutoForm } from "@/components/news/auto-form"
import { Timeline } from "@/components/news/timeline"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { getBoard, isRecent } from "@/lib/board"
import { getDigest, getSummary, toStories } from "@/lib/digest"
import { ago, utcDay, utcTime } from "@/lib/format"
import { byNewest, getIntel, isVisible, KIND_LABEL } from "@/lib/intel"
import { PAGES, pageMeta } from "@/lib/seo"
import { parseShow, type Show, timeline } from "@/lib/timeline"
import {
  type ActivityCommit,
  getActivity,
  getNews,
  getTracker,
  type PullRequest,
} from "@/lib/tracker"
import { cn } from "@/lib/utils"

export const revalidate = 60
export const metadata = {
  ...pageMeta(PAGES.news),
  alternates: {
    canonical: PAGES.news.path,
    types: {
      "application/rss+xml": [
        { url: "/feed.xml", title: "VIPortLive: articles and board" },
        { url: "/intelligence/feed.xml", title: "VIPortLive Intelligence" },
      ],
      "application/feed+json": [
        { url: "/intelligence/feed.json", title: "VIPortLive Intelligence" },
      ],
    },
  },
}

type Params = {
  show?: string
  project?: string
  kind?: string
  confidence?: string
  before?: string
  q?: string
  topic?: string
  category?: string
  sort?: string
}
type Props = { searchParams: Promise<Params> }

const link = "underline-offset-4 hover:underline"
const muted = "underline underline-offset-4 hover:text-foreground"
const KINDS = ["reference", "update", "evidence", "claim", "takedown", "duplicate"]
const PER_PAGE = 25
const isPull = (item: PullRequest | ActivityCommit): item is PullRequest => "number" in item

/** The address of a view, keeping only what that view reads. */
function href(show: Show, extra: Record<string, string | undefined> = {}) {
  const q = new URLSearchParams()
  if (show !== "all") q.set("show", show)
  for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v)
  const s = q.toString()
  return s ? `/news?${s}` : "/news"
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}

export default async function Page({ searchParams }: Props) {
  const params = await searchParams
  const show = parseShow(params as Record<string, string | undefined>)
  const [tracker, feed, digest, board, activity, intel] = await Promise.all([
    getTracker(),
    getNews(),
    getDigest(),
    getBoard(),
    getActivity(),
    getIntel(),
  ])
  const now = new Date().toISOString()
  const names = new Map(tracker.efforts.map((e) => [e.id, e.name]))
  const project = params.project && names.has(params.project) ? params.project : null
  const mine = <T extends { projectId: string | null }>(x: T) => !project || x.projectId === project

  const stories = toStories(feed, digest)
  const summary = getSummary(digest, feed, tracker)
  const busy = (summary?.projects ?? []).filter((b) => !project || b.id === project)
  const reports = intel.items.filter(isVisible).sort(byNewest)
  const pulls = activity.feed.filter(isPull)
  const commits = activity.feed.filter((i): i is ActivityCommit => !isPull(i))
  const notices = tracker.dmca.filter((d) => d.gta6)
  const tracked = new Set(tracker.efforts.map((e) => e.repo?.toLowerCase()).filter(Boolean))
  const projectName = (item: PullRequest | ActivityCommit) =>
    (item.projectId && names.get(item.projectId)) || item.repo

  const day = (at: string) => Date.parse(now) - Date.parse(at) < 864e5
  const glance = [
    {
      show: "reports" as const,
      label: "Reports",
      total: reports.length,
      fresh: reports.filter((r) => day(r.at)).length,
    },
    {
      show: "stories" as const,
      label: "Stories",
      total: stories.length,
      fresh: stories.filter((s) => day(s.date)).length,
    },
    {
      show: "code" as const,
      label: "Code",
      total: activity.feed.length,
      fresh: activity.feed.filter((x) => day(x.at)).length,
    },
    {
      show: "board" as const,
      label: "Board",
      total: board.length + notices.length,
      fresh: board.filter((e) => isRecent(e, 1, Date.parse(now))).length,
    },
  ]
  const tabs = [
    { show: "all" as const, label: "Everything", total: null as number | null },
    ...glance,
  ]
  const updated = [feed.updated, activity.updated, intel.updated]
    .filter((d): d is string => Boolean(d))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0]

  // Project choices: the board's projects that have something here.
  const used = new Set(
    [...reports, ...activity.feed, ...board].map((x) => x.projectId).filter(Boolean) as string[]
  )
  const projects = [...used]
    .filter((id) => names.has(id))
    .map((id) => [id, names.get(id) as string] as const)
    .sort((a, b) => a[1].localeCompare(b[1]))

  const filters = show !== "stories" && (
    <AutoForm className="mt-5 flex flex-wrap items-end gap-3 text-sm">
      {show !== "all" && <input type="hidden" name="show" value={show} />}
      <Field id="news-project" label="Project">
        <NativeSelect
          id="news-project"
          name="project"
          defaultValue={project ?? ""}
          className="w-full sm:w-56"
        >
          <NativeSelectOption value="">Every project</NativeSelectOption>
          {projects.map(([id, name]) => (
            <NativeSelectOption key={id} value={id}>
              {name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      {show === "reports" && (
        <>
          <Field id="news-kind" label="Kind">
            <NativeSelect id="news-kind" name="kind" defaultValue={params.kind ?? ""}>
              <NativeSelectOption value="">Every kind</NativeSelectOption>
              {KINDS.map((k) => (
                <NativeSelectOption key={k} value={k}>
                  {KIND_LABEL[k] ?? k}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field id="news-confidence" label="Confidence">
            <NativeSelect
              id="news-confidence"
              name="confidence"
              defaultValue={params.confidence ?? ""}
            >
              <NativeSelectOption value="">Any</NativeSelectOption>
              <NativeSelectOption value="high">High</NativeSelectOption>
              <NativeSelectOption value="moderate">Moderate</NativeSelectOption>
              <NativeSelectOption value="low">Low</NativeSelectOption>
            </NativeSelect>
          </Field>
        </>
      )}
      {(project || params.kind || params.confidence) && (
        <Link
          href={href(show)}
          className="h-9 py-2 text-muted-foreground underline underline-offset-4"
        >
          Clear
        </Link>
      )}
    </AutoForm>
  )

  return (
    <Container className="grid grid-cols-[minmax(0,1fr)] gap-x-12 gap-y-10 pt-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="text-2xl font-semibold">News</h1>
          {updated && (
            <p className="text-xs text-muted-foreground">
              Updated{" "}
              <time dateTime={updated} title={utcTime(updated)}>
                {ago(updated, now)}
              </time>
            </p>
          )}
        </div>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Everything happening around the GTA VI PC ports, in one place: our automated reports, the
          press, code on GitHub, and projects joining or going down. Reports run every 15 minutes;
          stories and code every half hour. Nothing here is official, and nothing here means a build
          is authentic.
        </p>

        <nav
          aria-label="Views"
          className="mt-5 -mx-1 flex gap-1 overflow-x-auto border-b pb-px text-sm [scrollbar-width:none]"
        >
          {tabs.map((t) => (
            <Link
              key={t.show}
              href={href(t.show, {
                project: t.show === "stories" ? undefined : (project ?? undefined),
              })}
              aria-current={show === t.show ? "page" : undefined}
              className={cn(
                "-mb-px flex shrink-0 items-baseline gap-1.5 border-b-2 border-transparent px-3 py-2 text-muted-foreground transition-colors hover:text-foreground",
                show === t.show && "border-foreground font-medium text-foreground"
              )}
            >
              {t.label}
              {t.total !== null && (
                <span className="text-xs tabular-nums text-muted-foreground">{t.total}</span>
              )}
            </Link>
          ))}
        </nav>

        {filters}

        {show === "all" && (
          <>
            {!project && <DigestSummary summary={summary} busy={false} />}
            <h2 className="sr-only">Timeline</h2>
            <div className="mt-6">
              <Timeline
                now={now}
                days={timeline(
                  {
                    intel: intel.items,
                    articles: tracker.news,
                    stories,
                    commits,
                    pulls,
                    board,
                    dmca: tracker.dmca,
                    names,
                  },
                  project
                )}
              />
            </div>
          </>
        )}

        {show === "reports" && (
          <Reports params={params} project={project} reports={reports} now={now} />
        )}

        {show === "stories" && (
          <>
            <h2 className="mt-6 text-lg font-semibold">Stories</h2>
            <Suspense fallback={<StoriesFallback stories={stories} sorted={digest !== null} />}>
              <Stories stories={stories} sorted={digest !== null} />
            </Suspense>
            {tracker.news.length > 0 && (
              <section className="mt-10" aria-labelledby="articles">
                <h2 id="articles" className="text-lg font-semibold">
                  Our articles
                </h2>
                <ul className="pane mt-2 px-5 py-2 wrap-anywhere">
                  {tracker.news.map((n) => (
                    <li key={n.id} className="border-b py-3 last:border-0">
                      <Link href={`/news/${n.id}`} className={link}>
                        <span className="block text-lg font-semibold text-balance">{n.title}</span>
                      </Link>
                      <span className="mt-1 block max-w-prose text-sm text-muted-foreground">
                        {n.dek}
                      </span>
                      <span className="mt-1.5 block text-xs text-muted-foreground">
                        {n.category},{" "}
                        <time dateTime={n.publishedAt ?? n.date}>
                          {utcDay(n.publishedAt ?? n.date)}
                          {n.publishedAt && `, ${utcTime(n.publishedAt)}`}
                        </time>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <details className="mt-10">
              <summary className="cursor-pointer text-lg font-semibold">
                Every headline, oldest kept
              </summary>
              <p className="mt-1 text-sm text-muted-foreground">
                The press list that came before the harvester, kept for the record.
              </p>
              <ul className="pane mt-3 px-5 py-2 wrap-anywhere">
                {[...new Map(tracker.headlines.map((h) => [h.link, h])).values()].map((h) => (
                  <li key={h.link} className="border-b py-2 text-sm last:border-0">
                    <a href={h.link} target="_blank" rel="noreferrer" className={link}>
                      {h.title}
                    </a>
                    <span className="block text-xs text-muted-foreground">
                      {h.outlet}, {utcDay(h.date)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}

        {show === "code" && (
          <>
            {busy.length > 0 && (
              <section className="mt-6" aria-labelledby="busy">
                <h2 id="busy" className="text-lg font-semibold">
                  Busy projects
                </h2>
                <ul className="pane mt-3 space-y-3 px-5 py-4 text-sm">
                  {busy.map((b) => (
                    <li key={b.id} className="max-w-prose">
                      <Link href={`/projects/${b.id}`} className={`font-semibold ${link}`}>
                        {b.name}
                      </Link>
                      <span className="block text-muted-foreground">{b.text}</span>
                    </li>
                  ))}
                </ul>
                {summary && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Written by an AI model from recent commit messages. It can be wrong.
                  </p>
                )}
              </section>
            )}
            <section className="mt-6" aria-labelledby="pulls">
              <h2 id="pulls" className="text-lg font-semibold">
                Pull requests{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  ({pulls.filter(mine).filter((p) => p.state === "open").length} open)
                </span>
              </h2>
              <CodeList
                empty={pulls.filter(mine).length === 0}
                items={pulls
                  .filter(mine)
                  .slice(0, 80)
                  .map((p) => (
                    <li key={`${p.repo}#${p.number}`} className="border-b py-2.5 text-sm">
                      <a href={p.url} target="_blank" rel="noreferrer" className={link}>
                        {p.title}
                      </a>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <Repo item={p} name={projectName(p)} /> #{p.number}, {p.state}
                        {p.draft ? " draft" : ""}, {p.author || "unknown"}, {utcDay(p.at)}{" "}
                        {ago(p.at, now)}
                      </p>
                    </li>
                  ))}
              />
            </section>
            <section className="mt-10" aria-labelledby="commits">
              <h2 id="commits" className="text-lg font-semibold">
                Commits
              </h2>
              <CodeList
                empty={commits.filter(mine).length === 0}
                items={commits
                  .filter(mine)
                  .slice(0, 100)
                  .map((c) => (
                    <li key={`${c.repo}@${c.sha}`} className="border-b py-2 text-sm">
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className={`${link} font-mono`}
                      >
                        {c.sha.slice(0, 7)}
                      </a>{" "}
                      <span className="text-muted-foreground">{c.message}</span>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <Repo item={c} name={projectName(c)} />, {c.author || "unknown"},{" "}
                        {utcDay(c.at)} {ago(c.at, now)}
                      </p>
                    </li>
                  ))}
              />
            </section>
          </>
        )}

        {show === "board" &&
          (() => {
            const events = board.filter(mine)
            const joined = events.filter((e) => e.kind === "joined")
            const gone = events.filter((e) => e.kind !== "joined")
            return (
              <>
                <section aria-labelledby="joined" className="mt-6">
                  <h2 id="joined" className="text-lg font-semibold">
                    New on the board
                  </h2>
                  {joined.length ? <BoardList events={joined} /> : <Quiet />}
                </section>
                <section aria-labelledby="dead" className="mt-8">
                  <h2 id="dead" className="text-lg font-semibold">
                    Down or inactive
                  </h2>
                  {gone.length ? <BoardList events={gone} /> : <Quiet />}
                </section>
              </>
            )
          })()}
      </div>

      <aside className="space-y-10">
        <section aria-labelledby="glance">
          <h2 id="glance" className="text-lg font-semibold">
            Last 24 hours
          </h2>
          <ul className="pane mt-3 grid grid-cols-2 gap-px overflow-hidden p-0">
            {glance.map((g) => (
              <li key={g.show}>
                <Link href={href(g.show)} className="block px-5 py-3 hover:bg-foreground/5">
                  <span className="block text-2xl font-semibold tabular-nums">{g.fresh}</span>
                  <span className="text-xs text-muted-foreground">{g.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="takedowns">
          <h2 id="takedowns" className="text-lg font-semibold">
            Takedown notices
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            GTA VI notices in GitHub’s public DMCA log.
          </p>
          {notices.length ? (
            <ul className="pane mt-3 px-5 py-2 wrap-anywhere">
              {notices.map((d) => (
                <li key={d.url} className="border-b py-3 text-sm last:border-0">
                  <a href={d.url} target="_blank" rel="noreferrer" className={link}>
                    Take-Two, {utcDay(d.date)}
                  </a>
                  {d.tracked.length > 0 && (
                    <span className="block text-xs text-muted-foreground">
                      Names {d.tracked.join(", ")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Quiet />
          )}
        </section>

        <section aria-labelledby="found">
          <h2 id="found" className="text-lg font-semibold">
            Found on GitHub
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Public repositories the harvester found. Not endorsed or scored.
          </p>
          <ul className="pane mt-3 px-5 py-1 wrap-anywhere *:last:border-0">
            {(show === "code" ? activity.discovered : activity.discovered.slice(0, 5)).map((r) => (
              <li key={r.repo} className="border-b py-2.5 text-sm">
                <a href={r.url} target="_blank" rel="noreferrer" className={link}>
                  {r.repo}
                </a>
                <span className="block text-xs text-muted-foreground">
                  {r.stars} stars, {r.language ?? "unknown language"}, pushed {utcDay(r.pushedAt)}
                  {tracked.has(r.repo.toLowerCase()) && ", on the board"}
                </span>
                {r.description && (
                  <span className="mt-0.5 line-clamp-3 block text-xs">{r.description}</span>
                )}
              </li>
            ))}
          </ul>
          {show !== "code" && activity.discovered.length > 5 && (
            <Link
              href={href("code")}
              className={`mt-2 inline-block text-sm text-muted-foreground ${muted}`}
            >
              All {activity.discovered.length}
            </Link>
          )}
        </section>

        <section aria-labelledby="follow" className="text-sm text-muted-foreground">
          <h2 id="follow" className="text-lg font-semibold text-foreground">
            Follow it
          </h2>
          <p className="mt-1">
            Reports:{" "}
            <a href="/intelligence/feed.xml" className={muted}>
              RSS
            </a>
            {" · "}
            <a href="/intelligence/feed.json" className={muted}>
              JSON Feed
            </a>
            {" · "}
            <a href="/api/v1/intel" className={muted}>
              API
            </a>
          </p>
          <p className="mt-1">
            Articles and the board:{" "}
            <a href="/feed.xml" className={muted}>
              RSS
            </a>
          </p>
          <p className="mt-3">
            Held reports wait in{" "}
            <Link href="/intelligence/queue" className={muted}>
              the queue
            </Link>
            . How things are scored is on the{" "}
            <Link href="/method" className={muted}>
              method
            </Link>{" "}
            page.
          </p>
        </section>
      </aside>
    </Container>
  )
}

function Quiet() {
  return <p className="pane mt-3 px-5 py-4 text-sm text-muted-foreground">Nothing on record.</p>
}

function CodeList({ items, empty }: { items: React.ReactNode[]; empty: boolean }) {
  if (empty) return <p className="mt-3 text-sm text-muted-foreground">Nothing scraped yet.</p>
  return <ul className="pane mt-3 px-5 py-1 wrap-anywhere *:last:border-0">{items}</ul>
}

function Repo({ item, name }: { item: PullRequest | ActivityCommit; name: string }) {
  return item.projectId ? (
    <Link href={`/projects/${item.projectId}`} className={link}>
      {name}
    </Link>
  ) : (
    <a href={`https://github.com/${item.repo}`} target="_blank" rel="noreferrer" className={link}>
      {item.repo}
    </a>
  )
}

function Reports({
  params,
  project,
  reports,
  now,
}: {
  params: Params
  project: string | null
  reports: Awaited<ReturnType<typeof getIntel>>["items"]
  now: string
}) {
  const filtered = reports.filter(
    (item) =>
      (!project || item.projectId === project) &&
      (!params.kind || item.kind === params.kind) &&
      (!params.confidence || item.confidence?.bucket === params.confidence)
  )
  const before = params.before
    ? filtered.filter((i) => Date.parse(i.at) < Date.parse(params.before as string))
    : filtered
  const shown = before.slice(0, PER_PAGE)
  const more = before.length > PER_PAGE ? before[PER_PAGE].at : null
  return (
    <section className="mt-6" aria-label="Reports">
      <p className="max-w-prose text-sm text-muted-foreground">
        Changes to the public build record as the desk finds them: new references, test reports,
        code changes and takedowns, each with its sources and how sure we are. Entries marked{" "}
        <strong>Under investigation</strong> are still in{" "}
        <Link href="/intelligence/queue" className={muted}>
          the queue
        </Link>
        .
      </p>
      <div className="pane mt-4 px-5 py-1">
        {shown.length === 0 ? (
          <p className="py-5 text-sm text-muted-foreground">
            Nothing matches. Quiet runs write no entries, so an empty list is normal.
          </p>
        ) : (
          shown.map((item) => <IntelCard key={item.id} item={item} now={now} />)
        )}
      </div>
      {more && (
        <p className="mt-4">
          <Link
            href={href("reports", {
              project: project ?? undefined,
              kind: params.kind,
              confidence: params.confidence,
              before: more,
            })}
            className="text-sm underline underline-offset-4 hover:text-foreground"
          >
            Older reports
          </Link>
        </p>
      )}
    </section>
  )
}
