import Link from "next/link"
import { Container } from "@/components/container"
import { IntelCard } from "@/components/intel/card"
import { ago } from "@/lib/format"
import { byNewest, getIntel, isVisible } from "@/lib/intel"
import { PAGES, pageMeta } from "@/lib/seo"

export const revalidate = 60
export const metadata = {
  ...pageMeta(PAGES.intelligence),
  alternates: {
    canonical: PAGES.intelligence.path,
    types: {
      "application/rss+xml": [{ url: "/intelligence/feed.xml", title: "VIPortLive Intelligence" }],
      "application/feed+json": [
        { url: "/intelligence/feed.json", title: "VIPortLive Intelligence" },
      ],
    },
  },
}

type Props = {
  searchParams: Promise<{ before?: string; project?: string; kind?: string; confidence?: string }>
}

const KINDS = ["reference", "update", "evidence", "claim", "takedown", "duplicate"]

export default async function Page({ searchParams }: Props) {
  const params = await searchParams
  const file = await getIntel()
  const now = new Date().toISOString()
  const visible = file.items.filter(isVisible).sort(byNewest)
  const filtered = visible.filter(
    (item) =>
      (!params.project || item.projectId === params.project) &&
      (!params.kind || item.kind === params.kind) &&
      (!params.confidence || item.confidence?.bucket === params.confidence)
  )
  const before = params.before
    ? filtered.filter((i) => Date.parse(i.at) < Date.parse(params.before as string))
    : filtered
  const shown = before.slice(0, 25)
  const more = before.length > 25 ? before[25].at : null
  const projects = [
    ...new Map(
      visible.filter((i) => i.projectId).map((i) => [i.projectId, i.projectName])
    ).entries(),
  ]

  return (
    <Container className="max-w-3xl pt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold">Intelligence</h1>
        <p className="text-xs text-muted-foreground">
          {file.baselineAt ? `Baseline ${ago(file.baselineAt, now)} · ` : ""}
          every 15 minutes
        </p>
      </div>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        Changes to the public build record, as they are found: new references, test reports, code
        changes and takedowns. Each entry carries its sources and how sure we are. Nothing here is
        official, and an entry never means a build is authentic.{" "}
        <Link href="/method" className="underline underline-offset-4 hover:text-foreground">
          How it is scored
        </Link>
        .
      </p>

      <form className="mt-5 flex flex-wrap items-end gap-3 text-sm" action="/intelligence">
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Project</span>
          <select
            name="project"
            defaultValue={params.project ?? ""}
            className="h-9 rounded-md border bg-transparent px-2"
          >
            <option value="">All</option>
            {projects.map(([id, name]) => (
              <option key={id} value={id as string}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Kind</span>
          <select
            name="kind"
            defaultValue={params.kind ?? ""}
            className="h-9 rounded-md border bg-transparent px-2"
          >
            <option value="">All</option>
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Confidence</span>
          <select
            name="confidence"
            defaultValue={params.confidence ?? ""}
            className="h-9 rounded-md border bg-transparent px-2"
          >
            <option value="">All</option>
            <option value="high">High</option>
            <option value="moderate">Moderate</option>
            <option value="low">Low</option>
          </select>
        </label>
        <button type="submit" className="h-9 rounded-md border px-3 hover:bg-muted">
          Filter
        </button>
        {(params.project || params.kind || params.confidence) && (
          <Link
            href="/intelligence"
            className="h-9 py-2 text-muted-foreground underline underline-offset-4"
          >
            Clear
          </Link>
        )}
      </form>

      <section className="mt-6" aria-label="Discoveries">
        {shown.length === 0 ? (
          <p className="pane px-5 py-6 text-sm text-muted-foreground">
            Nothing matches yet. Quiet runs write no entries, so an empty feed is normal.
          </p>
        ) : (
          shown.map((item) => <IntelCard key={item.id} item={item} now={now} />)
        )}
        {more && (
          <p className="mt-4">
            <Link
              href={`/intelligence?${new URLSearchParams({ ...(params.project && { project: params.project }), ...(params.kind && { kind: params.kind }), ...(params.confidence && { confidence: params.confidence }), before: more }).toString()}`}
              className="text-sm underline underline-offset-4 hover:text-foreground"
            >
              Older entries
            </Link>
          </p>
        )}
      </section>

      <p className="mt-6 text-sm text-muted-foreground">
        Entries marked <strong>Under investigation</strong> are still in the queue.{" "}
        <Link
          href="/intelligence/queue"
          className="underline underline-offset-4 hover:text-foreground"
        >
          See the queue
        </Link>
        .
      </p>

      <section className="mt-10 border-t pt-4 text-sm text-muted-foreground">
        <h2 className="font-medium text-foreground">Follow it</h2>
        <p className="mt-1">
          <a
            href="/intelligence/feed.xml"
            className="underline underline-offset-4 hover:text-foreground"
          >
            RSS
          </a>
          {" · "}
          <a
            href="/intelligence/feed.json"
            className="underline underline-offset-4 hover:text-foreground"
          >
            JSON Feed
          </a>
          {" · "}
          <a href="/api/v1/intel" className="underline underline-offset-4 hover:text-foreground">
            API
          </a>
          . Only published reports enter a feed; the queue stays here.
        </p>
      </section>
    </Container>
  )
}
