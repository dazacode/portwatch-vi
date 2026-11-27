import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Breadcrumb } from "@/components/breadcrumb"
import { Container } from "@/components/container"
import { IntelCard } from "@/components/intel/card"
import { Share } from "@/components/intel/share"
import { JsonLd } from "@/components/json-ld"
import { ago, utcDay, utcTime } from "@/lib/format"
import { byNewest, confidenceLabel, getIntel, KIND_LABEL, reportOf } from "@/lib/intel"
import { pageMeta, pageUrl } from "@/lib/seo"
import { SITE } from "@/lib/site"

export const revalidate = 60

type Props = { params: Promise<{ id: string }> }

const find = async (id: string) => (await getIntel()).items.find((i) => i.id === id)

export async function generateStaticParams() {
  return (await getIntel()).items.filter((i) => i.status !== "observed").map(({ id }) => ({ id }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const item = await find((await params).id)
  if (!item) return {}
  const meta = pageMeta({
    title: item.title,
    description: item.oneLine,
    path: `/intelligence/${item.id}`,
    published: item.at,
  })
  const open = item.status === "published"
  return {
    ...meta,
    alternates: {
      canonical: `/intelligence/${item.id}`,
      types: {
        "application/rss+xml": [
          { url: "/intelligence/feed.xml", title: "VIPortLive Intelligence" },
        ],
      },
    },
    robots: open ? undefined : { index: false, follow: true },
    openGraph: {
      ...meta.openGraph,
      images: [
        {
          url: `/intelligence/${item.id}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: item.title,
        },
      ],
    },
    twitter: {
      ...meta.twitter,
      images: [`/intelligence/${item.id}/opengraph-image`],
    },
  }
}

export default async function Page({ params }: Props) {
  const { id } = await params
  const file = await getIntel()
  const item = file.items.find((i) => i.id === id)
  if (!item) notFound()
  const report = reportOf(file, item)
  const now = new Date().toISOString()
  const published = item.status === "published"
  const related = file.items
    .filter(
      (i) =>
        i.id !== item.id &&
        i.projectId &&
        i.projectId === item.projectId &&
        i.status === "published"
    )
    .sort(byNewest)
    .slice(0, 3)

  // Only what the page shows.
  const ld = {
    "@type": "NewsArticle",
    headline: item.title,
    description: item.oneLine,
    datePublished: item.at,
    dateModified: report?.updatedAt ?? report?.publishedAt ?? item.at,
    url: pageUrl(`/intelligence/${item.id}`),
    isPartOf: { "@type": "WebSite", name: SITE.name, url: SITE.url },
    publisher: { "@type": "Organization", name: SITE.name },
    articleSection: KIND_LABEL[item.kind] ?? item.kind,
    ...(published ? {} : { creativeWorkStatus: "Under investigation" }),
  }

  return (
    <Container className="max-w-2xl pt-8 wrap-anywhere">
      <JsonLd data={ld} />
      <Breadcrumb
        parent={{ name: "News", path: "/news" }}
        page={{ name: item.title, path: `/intelligence/${item.id}` }}
      />

      {item.status === "retracted" && (
        <p className="mt-4 border-l-2 border-stripe-1 bg-muted px-4 py-3 text-sm">
          <strong>Retracted.</strong>{" "}
          {item.audit?.detail ?? "A stronger source contradicted this entry."} The record is kept
          below.
        </p>
      )}

      <p className="mt-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        VIPORTLIVE / INTELLIGENCE REPORT
      </p>
      <h1 className="mt-1 text-3xl font-bold text-balance">{item.title}</h1>
      <p className="mt-2 text-lg text-muted-foreground">{item.oneLine}</p>

      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span>Automated report</span>
        <span aria-hidden="true">·</span>
        <time dateTime={item.at}>
          {utcDay(item.at)}, {utcTime(item.at)}
        </time>
        <span aria-hidden="true">·</span>
        <span>{ago(item.at, now)}</span>
        <span aria-hidden="true">·</span>
        <Share title={item.title} />
      </p>

      <dl className="pane mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 p-4 text-sm">
        <dt className="text-muted-foreground">Confidence</dt>
        <dd className="font-medium">{confidenceLabel(item)}</dd>
        <dt className="text-muted-foreground">Reason</dt>
        <dd>{item.confidence?.reasons?.join("; ") || "A single stored source"}</dd>
        <dt className="text-muted-foreground">Stage</dt>
        <dd>{KIND_LABEL[item.kind] ?? item.kind}</dd>
        {item.projectName && (
          <>
            <dt className="text-muted-foreground">Project</dt>
            <dd>
              {item.projectId ? (
                <Link href={`/projects/${item.projectId}`} className="underline underline-offset-4">
                  <span translate="no">{item.projectName}</span>
                </Link>
              ) : (
                item.projectName
              )}
            </dd>
          </>
        )}
      </dl>

      {!published && (
        <p className="mt-4 text-sm text-muted-foreground">
          {item.status === "held"
            ? "This entry is still in the queue. It is not in RSS, the API or Discord yet."
            : "The entry is kept for the record."}
          {item.heldReasons?.length ? ` Held: ${item.heldReasons.join("; ")}.` : ""}
        </p>
      )}

      {report ? (
        <div className="mt-6 space-y-5">
          {(
            [
              ["Overview", report.overview],
              ["What changed", report.changed],
              ["Supporting evidence", report.evidence],
              ["What remains unknown", report.unknown],
            ] as const
          ).map(([heading, text]) => (
            <section key={heading}>
              <h2 className="font-semibold">{heading}</h2>
              <p className="mt-1 max-w-prose">{text}</p>
            </section>
          ))}
        </div>
      ) : (
        <p className="pane mt-6 p-4 text-sm text-muted-foreground">
          No report was written for this entry yet. The sources are below.
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-medium">Sources</h2>
        <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
          {item.sources.map((source) => (
            <li key={source.url}>
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4 hover:text-foreground"
              >
                {source.outlet}: {source.title}
              </a>
              <span className="ml-2 text-xs uppercase tracking-wide">{source.kind}</span>
            </li>
          ))}
        </ul>
      </section>

      {item.similar.length > 0 && (
        <section className="mt-6 text-sm">
          <h2 className="font-medium">Looks like</h2>
          <ul className="mt-1 space-y-1 text-muted-foreground">
            {item.similar.map((s) => (
              <li key={s.effortId}>
                <Link href={`/projects/${s.effortId}`} className="underline underline-offset-4">
                  {s.effortId}
                </Link>{" "}
                ({Math.round(s.score * 100)}% similar)
              </li>
            ))}
          </ul>
        </section>
      )}

      {item.revisions.length > 0 && (
        <section className="mt-8 border-t pt-4">
          <h2 className="text-sm font-medium">Record</h2>
          <ol className="mt-2 space-y-1 text-xs text-muted-foreground">
            {[...item.revisions].reverse().map((r) => (
              <li key={`${r.at}-${r.note}`}>
                <time dateTime={r.at}>{utcTime(r.at)}</time> · {r.by} · {r.note}
              </li>
            ))}
          </ol>
        </section>
      )}

      <p className="mt-8 text-xs text-muted-foreground">
        Automated from public sources. It may be wrong; the{" "}
        <Link href="/news?show=reports" className="underline underline-offset-4">
          feed
        </Link>{" "}
        and the sources above are the record. Nothing here hosts or links to game files.
      </p>

      {related.length > 0 && (
        <section className="mt-10 border-t pt-4">
          <h2 className="text-sm font-medium">More on {item.projectName}</h2>
          {related.map((r) => (
            <IntelCard key={r.id} item={r} now={now} />
          ))}
        </section>
      )}
    </Container>
  )
}
